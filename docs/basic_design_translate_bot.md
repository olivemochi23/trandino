# 基本設計書: Discord翻訳ボット

## 1. システム概要

本システムは、Discord上で指定されたチャンネルに投稿された日本語以外のメッセージを自動検知し、日本語に翻訳して投稿するボットである。また、ボットが生成するUI要素（コマンド応答やボタンラベルなど）も日本語でユーザーに提供する。

## 2. システムアーキテクチャ

### 2.1 全体構成

システムは以下の主要コンポーネントで構成される：

```
【Discord API】 ⟷ 【Discord.js】 ⟷ 【Bot Core】 ⟷ 【Google Cloud Translation API】
                                    ↑ 
                                    ↓
                                【JSONファイルストア】
```

- **Discord API**: Discordプラットフォームとの通信インターフェース
- **Discord.js**: Discord APIをJavaScriptから扱うためのライブラリ
- **Bot Core**: 本システムのメイン処理を担当
- **Google Cloud Translation API**: 言語検出と翻訳機能を提供
- **JSONファイルストア**: 設定データの永続化

### 2.2 技術スタック

- **実装言語**: Node.js (v20.x以上)
- **モジュール形式**: ES Modules
- **フレームワーク**: Discord.js (v14.x)
- **翻訳API**: Google Cloud Translation API
- **データストア**: JSONファイルベース
- **言語検出**: Google Cloud Translation API の言語検出機能
- **環境変数管理**: dotenv
- **ロギング**: Winston
- **テストフレームワーク**: Jest

## 3. 機能設計

### 3.1 メッセージ翻訳機能

#### 処理フロー

1. Discord.jsによりチャンネルのメッセージをリッスン
2. メッセージが監視対象チャンネルから送信されたか確認
3. Google Cloud Translation APIを用いてメッセージの言語を判定
4. 日本語以外の場合、Google Cloud Translation APIを用いて日本語に翻訳
5. 翻訳結果を整形（元の言語情報を含める）
6. 翻訳結果をDiscordチャンネルに送信

#### 使用技術

```javascript
// Google Cloud Translation APIの初期化
import { TranslationServiceClient } from '@google-cloud/translate';
const translationClient = new TranslationServiceClient();
const projectId = process.env.GOOGLE_PROJECT_ID;
const location = 'global';

// 言語検出
const detectLanguage = async (text) => {
  const request = {
    parent: `projects/${projectId}/locations/${location}`,
    content: text,
    mimeType: 'text/plain',
  };
  
  const [response] = await translationClient.detectLanguage(request);
  const detections = response.languages || [];
  
  // 最も確度の高い言語を取得
  if (detections.length > 0) {
    const topDetection = detections[0];
    return {
      language: topDetection.languageCode,
      confidence: topDetection.confidence,
      isJapanese: topDetection.languageCode === 'ja'
    };
  }
  
  return { language: 'und', confidence: 0, isJapanese: false };
};

// 翻訳
const translateText = async (text, sourceLanguage) => {
  const request = {
    parent: `projects/${projectId}/locations/${location}`,
    contents: [text],
    mimeType: 'text/plain',
    sourceLanguageCode: sourceLanguage,
    targetLanguageCode: 'ja',
  };
  
  const [response] = await translationClient.translateText(request);
  return response.translations[0].translatedText;
};
```

### 3.2 言語判定機能

- Google Cloud Translation APIの言語判定機能を使用
- 信頼度スコアが0.7未満の場合はフォールバック処理（翻訳を行わない）
- 短文（10文字以下）の場合は特別処理（言語判定の信頼度閾値を0.8に引き上げる）
- **言語判定・翻訳結果のキャッシュ機構を実装**
  - TTLベースのインメモリキャッシュ（30分）
  - 最大100エントリまでキャッシュ
  - 同一テキストに対するAPI呼び出しを削減

### 3.3 ボットUI翻訳機能

- ボットのコマンド応答、エラーメッセージなどは日本語でハードコード
- Discord.jsのLocaleマッピング機能を活用
- 言語リソースファイルで管理（後の拡張性を考慮）

```javascript
// 言語リソースの例
const locales = {
  'en': {
    'HELP_TITLE': 'Translation Bot Help',
    'HELP_DESCRIPTION': 'This bot translates messages to Japanese'
    // ...
  },
  'ja': {
    'HELP_TITLE': '翻訳ボットヘルプ',
    'HELP_DESCRIPTION': 'このボットはメッセージを日本語に翻訳します'
    // ...
  }
};
```

### 3.4 チャンネル指定機能

#### データモデル

```javascript
// チャンネル設定の例
{
  "guild_id": {
    "channels": ["channel_id1", "channel_id2"],
    "enabled": true,
    "last_updated": "ISO日付文字列",
    "updated_by": "ユーザーID"
  }
}
```

#### 永続化方法

JSONファイルを使用して設定を保存・読み込み。ファイル操作にはNode.jsの`fs/promises`モジュールを使用。

```javascript
// 設定保存の例
import fs from 'fs/promises';
import path from 'path';

const saveChannelConfig = async (guildId, config) => {
  const configPath = path.join(process.env.DATA_DIR, 'channels.json');
  let allConfigs = {};
  
  try {
    const data = await fs.readFile(configPath, 'utf-8');
    allConfigs = JSON.parse(data);
  } catch (err) {
    // ファイルが存在しない場合は新規作成
    if (err.code !== 'ENOENT') throw err;
  }
  
  allConfigs[guildId] = config;
  await fs.writeFile(configPath, JSON.stringify(allConfigs, null, 2), 'utf-8');
};
```

### 3.5 コマンド機能

Discord.jsのSlashCommand機能を利用して以下のコマンドを実装:

#### `/translate-help`
```javascript
new SlashCommandBuilder()
  .setName('translate-help')
  .setDescription('ボットの使用方法を表示します')
```

#### `/translate-config channel`
```javascript
new SlashCommandBuilder()
  .setName('translate-config')
  .setDescription('翻訳ボットの設定を変更します')
  .addSubcommand(subcommand =>
    subcommand
      .setName('channel')
      .setDescription('翻訳対象チャンネルを設定します')
      .addChannelOption(option => 
        option.setName('channel')
          .setDescription('翻訳を有効にするチャンネル')
          .setRequired(true)))
```

#### `/translate-config list`
```javascript
// translate-configのサブコマンドとして
.addSubcommand(subcommand =>
  subcommand
    .setName('list')
    .setDescription('現在の設定を表示します'))
```

## 4. モジュール設計

### 4.1 ディレクトリ構造

```
/
├── config/             # 設定ファイル
│   ├── config.js       # メイン設定
│   └── locales/        # 言語リソース
├── data/               # データファイル
│   └── channels.json   # チャンネル設定
├── src/                # ソースコード
│   ├── index.js        # エントリーポイント
│   ├── bot.js          # ボットメインクラス
│   ├── commands/       # スラッシュコマンド
│   │   ├── help.js     # ヘルプコマンド
│   │   └── config.js   # 設定コマンド
│   ├── events/         # イベントハンドラ
│   │   ├── ready.js    # 起動イベント
│   │   └── message.js  # メッセージイベント
│   ├── services/       # サービス
│   │   ├── translation-service.js  # 翻訳サービス
│   │   └── channel-manager.js      # チャンネル管理
│   ├── tests/          # テストコード
│   │   ├── translation-service.test.js  # 翻訳サービステスト
│   │   └── channel-manager.test.js      # チャンネル管理テスト
│   └── utils/          # ユーティリティ
│       ├── logger.js    # ロギング
│       └── config-util.js # 設定ユーティリティ
├── .env                # 環境変数（Git管理外）
├── package.json        # 依存関係
└── README.md           # ドキュメント
```

### 4.2 主要クラス・モジュール

#### `TranslateBot` クラス

```javascript
class TranslateBot {
  constructor(config) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });
    this.config = config;
    this.translationService = new TranslationService(config.translation);
    this.channelManager = new ChannelManager(config.storage);
    this.logger = createLogger(config.logging);
  }
  
  async start() {
    // Discord.jsクライアントの初期化
    this.client.once('ready', () => this.onReady());
    this.client.on('messageCreate', (message) => this.handleMessage(message));
    this.client.on('interactionCreate', (interaction) => this.handleInteraction(interaction));
    
    // Bot起動
    await this.client.login(this.config.discord.token);
  }
  
  async onReady() {
    this.logger.info(`Bot logged in as ${this.client.user.tag}`);
    await this.registerCommands();
  }
  
  async registerCommands() {
    // スラッシュコマンド登録
  }
  
  async handleMessage(message) {
    // メッセージ処理
    if (message.author.bot) return;
    
    try {
      const guildId = message.guild?.id;
      if (!guildId) return; // DMは無視
      
      // チャンネルが翻訳対象か確認
      const isTargetChannel = await this.channelManager.isEnabledChannel(guildId, message.channel.id);
      if (!isTargetChannel) return;
      
      // 言語検出と翻訳
      const detectResult = await this.translationService.detectLanguage(message.content);
      if (!detectResult.isJapanese && detectResult.confidence > 0.7) {
        const translated = await this.translationService.translate(
          message.content, 
          detectResult.language
        );
        
        // 翻訳結果の整形と送信
        const formattedResult = this.translationService.formatTranslationResult(
          message.content,
          translated,
          detectResult.language
        );
        
        await message.channel.send(formattedResult);
      }
    } catch (error) {
      this.logger.error('Error processing message', { error, messageId: message.id });
    }
  }
  
  async handleInteraction(interaction) {
    // スラッシュコマンド処理
  }
}
```

#### `TranslationService` クラス

```javascript
class TranslationService {
  constructor(config) {
    this.translationClient = new TranslationServiceClient();
    this.projectId = config.projectId;
    this.location = config.location || 'global';
    this.targetLanguage = config.targetLanguage || 'ja';
    
    // キャッシュの設定
    this.cache = {
      detection: new Map(), // 言語検出結果のキャッシュ
      translation: new Map(), // 翻訳結果のキャッシュ
      maxSize: config.cacheMaxSize || 100, // キャッシュの最大サイズ
      ttl: config.cacheTtl || 1000 * 60 * 30 // キャッシュの有効期間（30分）
    };
  }
  
  async detectLanguage(text) {
    if (!text || text.trim().length === 0) {
      return { language: 'und', confidence: 0, isJapanese: false };
    }
    
    // キャッシュをチェック
    const cacheKey = `detect_${text.substring(0, 100)}`;
    const cachedResult = this.getFromCache('detection', cacheKey);
    if (cachedResult) {
      this.logger.debug('言語検出結果をキャッシュから取得しました');
      return cachedResult;
    }
    
    const request = {
      parent: `projects/${this.projectId}/locations/${this.location}`,
      content: text,
      mimeType: 'text/plain',
    };
    
    try {
      const [response] = await this.translationClient.detectLanguage(request);
      const detections = response.languages || [];
      
      if (detections.length > 0) {
        const topDetection = detections[0];
        const result = {
          language: topDetection.languageCode,
          confidence: topDetection.confidence,
          isJapanese: topDetection.languageCode === 'ja'
        };
        
        // 結果をキャッシュに保存
        this.addToCache('detection', cacheKey, result);
        
        return result;
      }
    } catch (error) {
      throw new Error(`Language detection failed: ${error.message}`);
    }
    
    return { language: 'und', confidence: 0, isJapanese: false };
  }
  
  async translate(text, sourceLanguage) {
    if (!text || text.trim().length === 0) {
      return '';
    }
    
    // キャッシュをチェック
    const cacheKey = `translate_${sourceLanguage}_${this.targetLanguage}_${text.substring(0, 100)}`;
    const cachedResult = this.getFromCache('translation', cacheKey);
    if (cachedResult) {
      this.logger.debug('翻訳結果をキャッシュから取得しました');
      return cachedResult;
    }
    
    const request = {
      parent: `projects/${this.projectId}/locations/${this.location}`,
      contents: [text],
      mimeType: 'text/plain',
      sourceLanguageCode: sourceLanguage,
      targetLanguageCode: this.targetLanguage,
    };
    
    try {
      const [response] = await this.translationClient.translateText(request);
      const translatedText = response.translations[0].translatedText;
      
      // 結果をキャッシュに保存
      this.addToCache('translation', cacheKey, translatedText);
      
      return translatedText;
    } catch (error) {
      throw new Error(`Translation failed: ${error.message}`);
    }
  }
  
  formatTranslationResult(original, translated, sourceLanguage) {
    // 言語コードから言語名を取得
    const languageName = this.getLanguageName(sourceLanguage);
    
    return {
      content: `[元の言語: ${languageName}]\n${translated}`,
      // 埋め込みを使用する場合
      embeds: [{
        color: 0x0099ff,
        description: translated,
        footer: {
          text: `元の言語: ${languageName}`
        }
      }]
    };
  }
  
  getLanguageName(languageCode) {
    // 言語コードから言語名へのマッピング
    const languageMap = {
      'en': '英語',
      'zh': '中国語',
      'ko': '韓国語',
      // 他の言語コードも追加
      'ja': '日本語',
      'und': '不明'
    };
    
    return languageMap[languageCode] || languageCode;
  }
  
  // キャッシュ関連のユーティリティメソッド
  getFromCache(type, key) {
    const cache = this.cache[type];
    if (!cache) return null;
    
    const item = cache.get(key);
    if (!item) return null;
    
    // TTLをチェック
    if (Date.now() > item.expires) {
      cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  addToCache(type, key, value) {
    const cache = this.cache[type];
    if (!cache) return;
    
    // キャッシュが最大サイズに達した場合、最も古いアイテムを削除
    if (cache.size >= this.cache.maxSize) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
    
    // 有効期限を計算してアイテムを保存
    const expires = Date.now() + this.cache.ttl;
    cache.set(key, { value, expires });
  }
}
```

#### `ChannelManager` クラス

```javascript
class ChannelManager {
  constructor(storageConfig) {
    this.dataDir = storageConfig.dataDir || './data';
    this.configPath = path.join(this.dataDir, 'channels.json');
    
    // データディレクトリの存在確認と作成
    fs.mkdirSync(this.dataDir, { recursive: true });
  }
  
  async loadConfig() {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // ファイルが存在しない場合は空のオブジェクトを返す
        return {};
      }
      throw error;
    }
  }
  
  async saveConfig(config) {
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }
  
  async isEnabledChannel(guildId, channelId) {
    const config = await this.loadConfig();
    const guildConfig = config[guildId];
    
    if (!guildConfig || !guildConfig.enabled) return false;
    return guildConfig.channels.includes(channelId);
  }
  
  async getEnabledChannels(guildId) {
    const config = await this.loadConfig();
    const guildConfig = config[guildId];
    
    if (!guildConfig || !guildConfig.enabled) return [];
    return guildConfig.channels;
  }
  
  async addChannel(guildId, channelId, userId) {
    const config = await this.loadConfig();
    
    if (!config[guildId]) {
      config[guildId] = {
        channels: [],
        enabled: true,
        last_updated: new Date().toISOString(),
        updated_by: userId
      };
    }
    
    if (!config[guildId].channels.includes(channelId)) {
      config[guildId].channels.push(channelId);
      config[guildId].last_updated = new Date().toISOString();
      config[guildId].updated_by = userId;
    }
    
    await this.saveConfig(config);
    return config[guildId];
  }
  
  async removeChannel(guildId, channelId, userId) {
    const config = await this.loadConfig();
    
    if (!config[guildId]) return null;
    
    config[guildId].channels = config[guildId].channels.filter(id => id !== channelId);
    config[guildId].last_updated = new Date().toISOString();
    config[guildId].updated_by = userId;
    
    await this.saveConfig(config);
    return config[guildId];
  }
}
```

## 5. データ設計

### 5.1 設定データ

チャンネル設定のスキーマ:

```json
{
  "guild_id1": {
    "enabled": true,
    "channels": ["channel_id1", "channel_id2"],
    "last_updated": "2023-11-10T12:34:56Z",
    "updated_by": "user_id"
  },
  "guild_id2": {
    "enabled": true,
    "channels": ["channel_id3"],
    "last_updated": "2023-11-09T09:12:34Z",
    "updated_by": "user_id"
  }
}
```

### 5.2 環境変数

```
# Discord Bot設定
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
GUILD_ID=your_guild_id  # 開発段階でのテスト用

# Google Cloud設定
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
GOOGLE_PROJECT_ID=your-google-project-id
GOOGLE_LOCATION=global

# その他
LOG_LEVEL=info
DATA_DIR=./data
```

## 6. インターフェース設計

### 6.1 Discord Bot表示

#### 翻訳結果フォーマット

```
[元の言語: 英語] 
翻訳されたテキスト
```

または埋め込みメッセージとして:

```
┌───────────────────────────┐
│ 翻訳されたテキスト        │
│                           │
│ 元の言語: 英語            │
└───────────────────────────┘
```

#### エラーメッセージ

- 翻訳失敗時: 「翻訳処理中にエラーが発生しました。しばらくしてからお試しください。」
- 権限エラー: 「このコマンドを使用する権限がありません。サーバー管理者に問い合わせてください。」

### 6.2 スラッシュコマンドUI

- 各コマンドには簡潔な説明を付ける
- オプションにはプレースホルダーやヒントを表示
- コマンド成功時は確認メッセージを表示（例: ✅ チャンネル設定を保存しました）

## 7. 例外処理設計

### 7.1 エラーハンドリング

- Google Cloud API接続エラー:
  - **一時的なエラー（503、429など）は指数バックオフ戦略で最大3回再試行**
  - 認証エラー（401、403）はログに詳細を記録し、適切なエラーメッセージを表示
  - 恒久的なエラーは管理者通知を行い、利用者には適切なメッセージを表示

- Discord API関連エラー:
  - レートリミット時は制限解除まで待機
  - 権限不足時は明確なエラーメッセージを表示
  - 接続エラーは指数バックオフ戦略で再接続

- 一般的なエラー:
  - すべてのエラーをキャッチして適切なログ記録
  - 未処理例外ハンドラを実装してクラッシュを防止

### 7.2 ロギング戦略

Winstonを使用した階層的ロギング:

```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'translate-bot' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ],
});
```

- 情報ログ: コマンド実行、チャンネル設定変更など
- 警告ログ: 一時的なAPI接続エラー、言語検出の低信頼度など
- エラーログ: 重大なエラー、システム障害など

## 8. セキュリティ設計

### 8.1 APIキー管理

- Google Cloud サービスアカウントキーは環境変数で管理(`GOOGLE_APPLICATION_CREDENTIALS`)
- ローカル開発時は`.env`ファイルで管理し、`.gitignore`に追加
- 本番環境ではGCPのシークレット管理サービスの利用を検討

### 8.2 権限管理

- コマンド実行権限はDiscordの権限システムを利用
  ```javascript
  // 権限チェックの例
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content: '設定を変更するには「サーバーの管理」権限が必要です。',
      ephemeral: true
    });
  }
  ```
- チャンネル設定変更は管理者権限を持つユーザーのみ許可
- 各アクションの実行者をログに記録

## 9. テスト計画

### 9.1 単体テスト

Jestを使用して主要サービスをモックテスト:

```javascript
// Jest設定例
"jest": {
  "testEnvironment": "node",
  "transform": {},
  "setupFilesAfterEnv": ["<rootDir>/src/tests/test-setup.js"],
  "moduleFileExtensions": ["js", "json"],
  "collectCoverage": true,
  "collectCoverageFrom": ["src/**/*.js", "!src/tests/**"],
  "coverageDirectory": "coverage"
}
```

- **TranslationServiceのモックテスト**
  - 言語検出のテスト（正確性、信頼度閾値、キャッシュ）
  - 翻訳機能のテスト（エラーケース、空テキスト、キャッシュ）
  
- **ChannelManagerのモックテスト**
  - 設定ファイル操作のテスト（読み込み・保存）
  - チャンネル管理のテスト（追加・削除・検証）
  - エラー処理のテスト

```javascript
// TranslationService のテスト例
describe('TranslationService', () => {
  let service;
  let mockClient;
  
  beforeEach(() => {
    // モックの設定
    mockClient = new MockTranslationServiceClient();
    
    // サービスの初期化
    service = new TranslationService({
      projectId: 'test-project',
      location: 'global'
    });
    service.translationClient = mockClient;
  });
  
  test('正しく日本語を検出すること', async () => {
    // モックの応答を設定
    mockClient.detectLanguage.mockResolvedValue([{
      languages: [{ languageCode: 'ja', confidence: 0.98 }]
    }]);
    
    const result = await service.detectLanguage('こんにちは');
    
    expect(result.isJapanese).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.9);
  });
  
  // キャッシュ機能のテスト...
  // 他のテストケース...
});
```

### 9.2 統合テスト

テスト環境のDiscordサーバーで実際の動作をテスト:

1. テスト用サーバーとチャンネルの設定
2. 異なる言語でのメッセージ送信テスト
3. 翻訳結果の検証
4. コマンド実行のテスト

### 9.3 負荷テスト

1. 高頻度メッセージシナリオのシミュレーション
2. Google Cloud APIの使用量モニタリング
3. メモリ使用量と応答時間の計測
4. リソース使用状況のロギングと分析

## 10. 実装計画

### フェーズ1: 基本機能実装（優先度高）

1. プロジェクト構成とDiscord.jsの初期設定
   - プロジェクトディレクトリ構造の作成
   - package.jsonの設定と依存関係のインストール
   - 基本的なボットの初期化とログイン処理

2. Google Cloud Translation APIとの連携
   - サービスアカウントの作成と認証設定
   - 言語検出と翻訳の基本機能実装
   - エラーハンドリングの基本実装

3. 言語判定機能の実装
   - 短文処理のロジック作成
   - 信頼度スコアに基づく判定処理
   - 日本語判定の最適化

4. チャンネルでのメッセージ監視と翻訳処理
   - メッセージイベント処理
   - チャンネル設定の基本的な読み込み
   - 翻訳結果の整形と送信

### フェーズ2: 拡張機能実装（優先度中）

1. スラッシュコマンドの実装
   - コマンド登録処理
   - ヘルプコマンド実装
   - 設定コマンド実装

2. 設定の永続化機能の実装
   - JSONファイル操作の実装
   - 設定変更時のファイル更新処理
   - 起動時の設定読み込み処理

3. ボットUIの翻訳対応
   - 言語リソースファイルの実装
   - 埋め込みメッセージのデザイン改善
   - エラーメッセージの日本語化

### フェーズ3: 品質向上と拡張（優先度低）

1. エラーハンドリングの強化
   - 再試行ロジックの実装
   - エラーケース別の処理分岐
   - ユーザーフレンドリーなエラーメッセージ

2. パフォーマンス最適化
   - キャッシュ機構の導入
   - Google Cloud APIコール最適化
   - メモリ使用量最適化

3. テスト拡充
   - 単体テストの追加
   - 統合テストの実装
   - テストカバレッジの向上

4. 将来的な拡張機能の検討
   - 翻訳対象言語の設定機能
   - ユーザー別の翻訳設定
   - 翻訳品質フィードバック機能

## 11. 運用保守計画

### 11.1 監視

- **構造化ロギングを実装し、JSONフォーマットでログを出力**
- Discord.jsのイベントエラーをキャッチしてロギング
- Google Cloud Monitoringを活用したAPI使用状況の監視
- 定期的なヘルスチェック処理の実装（15分間隔）
- エラー率が一定閾値を超えた場合のアラート設定

### 11.2 バックアップ

- チャンネル設定データの日次バックアップ
- Google Cloud Storageを使用したバックアップ保存（オプション）
- バックアップからの復元手順の整備と定期的なテスト

### 11.3 アップデート計画

- Discord.jsの新バージョン対応（メジャーバージョンアップ時）
- Google Cloud Translation APIの仕様変更への対応
- 運用フィードバックに基づく機能改善（月次レビュー）
- セキュリティアップデートの迅速な適用 