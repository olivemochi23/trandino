# Discord翻訳ボット セットアップガイド (2025年版)

このガイドでは、Discord翻訳ボットの開発環境構築からGoogle Cloud Translation APIとDiscord API設定までの一連の手順を解説します。

## 目次

1. [開発環境構築](#1-開発環境構築)
2. [Google Cloud設定](#2-google-cloud設定)
3. [Discord Bot設定](#3-discord-bot設定)
4. [プロジェクト初期化](#4-プロジェクト初期化)
5. [環境変数の設定](#5-環境変数の設定)
6. [動作確認](#6-動作確認)
7. [トラブルシューティング](#7-トラブルシューティング)

## 1. 開発環境構築

### 1.1 Node.jsのインストール

1. [Node.js公式サイト](https://nodejs.org/)から最新のLTS版（v20.x以上）をダウンロードしてインストール
2. インストール完了後、ターミナル/コマンドプロンプトで次のコマンドを実行して正常にインストールされたか確認

```bash
node -v  # Node.jsのバージョンを表示
npm -v   # npmのバージョンを表示
```

または、Node Version Manager (nvm)を使用した方法も推奨されています：

```bash
# Linuxまたはmacの場合
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# または
wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Windowsの場合は、nvm-windowsをインストール
# https://github.com/coreybutler/nvm-windows/releases

# nvmでNode.jsをインストール
nvm install --lts
nvm use --lts
```

### 1.2 Gitのインストール

1. [Git公式サイト](https://git-scm.com/downloads)からGitをダウンロードしてインストール
2. インストール完了後、次のコマンドで確認

```bash
git --version  # Gitのバージョンを表示
```

### 1.3 コードエディタのインストール（推奨）

1. [Visual Studio Code公式サイト](https://code.visualstudio.com/)からダウンロードしてインストール
2. 以下の拡張機能をインストールすると開発効率が上がります：
   - ESLint
   - Prettier
   - npm Intellisense
   - JavaScript (ES6) code snippets
   - Thunder Client（APIテスト用、Postmanの代替）
   - GitHub Copilot（AIによるコード補完）

## 2. Google Cloud設定

### 2.1 Googleアカウントの準備

1. Googleアカウントをお持ちでない場合は、[Google アカウントの作成ページ](https://accounts.google.com/signup)で作成

### 2.2 Google Cloudプロジェクトの作成

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 上部のプロジェクト選択メニューをクリック → 「新しいプロジェクト」を選択
3. プロジェクト名に「discord-translate-bot」など分かりやすい名前を入力し、「作成」をクリック
4. プロジェクトが作成されるまで数秒待ち、作成後は自動的に新しいプロジェクトに切り替わります

### 2.3 Cloud Translation API v3の有効化

1. 左側のナビゲーションメニューから「APIとサービス」→「ライブラリ」を選択
2. 検索ボックスに「Cloud Translation API」と入力し、検索結果から「Cloud Translation API」を選択
3. 「有効にする」ボタンをクリックしてAPIを有効化

### 2.4 サービスアカウントの作成と認証設定

1. 左側のナビゲーションメニューから「IAMと管理」→「サービスアカウント」を選択
2. 「サービスアカウントを作成」をクリック
3. サービスアカウント名に「translate-bot-service」など分かりやすい名前を入力し、「作成して続行」をクリック
4. 「ロールを選択」で「Cloud Translation API ユーザー」を選択し、「完了」をクリック
5. 作成したサービスアカウントの行にある「操作」ボタン（縦三点）をクリックし、「鍵を管理」を選択
6. 「鍵を追加」→「新しい鍵を作成」を選択
7. 「JSON」を選択し、「作成」をクリックするとキーファイルがダウンロードされます
8. ダウンロードしたJSONファイルは安全な場所に保存してください（セキュリティのため、このファイルはプロジェクトディレクトリ外に保存し、Gitリポジトリにコミットしないでください）

### 2.5 APIキーのセキュリティ設定（推奨）

セキュリティを強化するために、Google CloudのSecret Managerを使用することも検討してください：

1. 左側のナビゲーションメニューから「セキュリティ」→「Secret Manager」を選択
2. 「シークレットを作成」をクリック
3. シークレット名を「translation-api-key」などに設定
4. シークレット値として、先ほどダウンロードしたJSONファイルの内容をコピー＆ペースト
5. 「作成」をクリックしてシークレットを保存

## 3. Discord Bot設定

### 3.1 Discord Developerポータルでのアプリケーション作成

1. [Discord Developer Portal](https://discord.com/developers/applications)にアクセス（Discordアカウントでログイン）
2. 右上の「New Application」ボタンをクリック
3. アプリケーション名に「TranslateBot」など分かりやすい名前を入力し、「Create」をクリック

### 3.2 Botの設定

1. 左側のメニューから「Bot」を選択
2. 「Add Bot」ボタンをクリックし、確認ダイアログで「Yes, do it!」をクリック
3. 「Reset Token」をクリックしてボットトークンを生成し、表示されたトークンを安全な場所に保存
4. 以下の設定を確認・設定します：
   - 「Public Bot」: 通常はOFF（自分のサーバーでのみ使用する場合）
   - 「Privileged Gateway Intents」セクションで以下を有効化：
     - 「Presence Intent」: OFF（必要な場合のみON）
     - 「Server Members Intent」: OFF（必要な場合のみON）
     - 「Message Content Intent」: ON（メッセージの内容を読む権限が必要なため）

### 3.3 OAuth2設定とBot招待URL

1. 左側のメニューから「OAuth2」→「URL Generator」を選択
2. 「SCOPES」セクションで以下にチェック：
   - `bot`
   - `applications.commands`
3. 「BOT PERMISSIONS」セクションで以下にチェック：
   - `Send Messages`
   - `Read Message History`
   - `Use Slash Commands`
   - `Embed Links`（埋め込みメッセージを使用する場合）
4. 生成されたURLをコピーし、ブラウザで開く
5. ボットを追加したいDiscordサーバーを選択し、「認証」をクリック
6. キャプチャを完了すると、ボットがサーバーに追加されます

## 4. プロジェクト初期化

### 4.1 プロジェクトディレクトリの作成

```bash
# プロジェクトディレクトリ作成
mkdir discord-translate-bot
cd discord-translate-bot

# Gitリポジトリの初期化
git init
```

### 4.2 package.jsonの作成

```bash
# package.jsonの対話的作成
npm init -y
```

または以下の内容の`package.json`ファイルを直接作成：

```json
{
  "name": "TranDino",
  "version": "1.0.0",
  "description": "Discord翻訳ボット",
  "main": "src/index.js",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "lint": "eslint src/**/*.js",
    "test": "jest"
  },
  "dependencies": {
    "discord.js": "^14.14.1",
    "@google-cloud/translate": "^8.0.1",
    "dotenv": "^16.3.1",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "eslint": "^8.56.0",
    "jest": "^29.7.0",
    "nodemon": "^3.0.2"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### 4.3 ESモジュールの使用

2025年現在、Node.jsではESモジュールが標準になっています。`package.json`に`"type": "module"`を追加し、以下のようにインポート構文を使用してください：

```javascript
// CommonJSスタイル（古い方法）
// const { Client } = require('discord.js');

// ESモジュールスタイル（推奨）
import { Client } from 'discord.js';
```

### 4.4 依存パッケージのインストール

```bash
# 依存パッケージのインストール
npm install

# 開発用パッケージのインストール
npm install --save-dev eslint nodemon jest
```

### 4.5 ディレクトリ構造の作成

以下のディレクトリ構造を作成：

```
discord-translate-bot/
├── config/
│   └── locales/          # 言語リソースファイル用
├── data/                 # データファイル用
├── src/
│   ├── commands/         # スラッシュコマンド
│   ├── events/           # イベントハンドラ
│   ├── services/         # サービス（翻訳など）
│   ├── utils/            # ユーティリティ
│   ├── bot.js            # ボットのメインクラス
│   └── index.js          # エントリーポイント
├── tests/                # テストコード
├── .env                  # 環境変数（Gitに含めない）
├── .env.example          # 環境変数のテンプレート
├── .eslintrc.json        # ESLint設定
├── .gitignore            # Gitの除外ファイル設定
└── package.json          # パッケージ情報
```

次のコマンドでディレクトリとファイルを作成：

```bash
mkdir -p config/locales data src/{commands,events,services,utils} tests
touch .env .env.example .gitignore .eslintrc.json src/{bot.js,index.js}
```

### 4.6 .gitignoreの設定

`.gitignore`ファイルに以下の内容を追加：

```
# 依存パッケージ
node_modules/

# 環境変数とAPIキー
.env
*.env
credentials.json
*-credentials.json
*-key.json
service-account-*.json

# ログ
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# 実行時データ
data/

# テスト
coverage/

# エディタ設定
.idea/
.vscode/
*.swp
*.swo

# OS生成ファイル
.DS_Store
Thumbs.db

# ビルド成果物
dist/
build/
```

### 4.7 ESLint設定（推奨）

`.eslintrc.json`ファイルに以下の内容を追加：

```json
{
  "env": {
    "node": true,
    "es2023": true
  },
  "extends": ["eslint:recommended"],
  "parserOptions": {
    "ecmaVersion": 2023,
    "sourceType": "module"
  },
  "rules": {
    "semi": ["error", "always"],
    "quotes": ["error", "single"],
    "no-unused-vars": "warn"
  }
}
```

## 5. 環境変数の設定

### 5.1 .env.exampleファイルの作成

`.env.example`ファイルに以下の内容を追加：

```
# Discord Bot設定
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
GUILD_ID=your_test_guild_id  # 開発中のみ使用

# Google Cloud設定
GOOGLE_APPLICATION_CREDENTIALS=path/to/your-google-credentials.json
GOOGLE_PROJECT_ID=your-google-project-id
GOOGLE_LOCATION=global

# アプリケーション設定
NODE_ENV=development
LOG_LEVEL=info
DATA_DIR=./data
```

### 5.2 .envファイルの作成

`.env.example`ファイルをコピーして`.env`ファイルを作成し、実際の値を設定：

```bash
cp .env.example .env
```

エディタで`.env`ファイルを開き、Discord BotトークンやGoogle Cloud設定などの実際の値を設定します。

## 6. 動作確認

### 6.1 基本的なbotコードの作成

ES Modules を使用した `src/index.js` の例：

```javascript
import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';

// クライアントの初期化
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// ボット起動時に実行
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// メッセージ受信時に実行
client.on('messageCreate', async (message) => {
  // ボット自身のメッセージは無視
  if (message.author.bot) return;
  
  console.log(`Message received: ${message.content}`);
  
  // 簡単な応答テスト
  if (message.content === '!ping') {
    await message.reply({ content: 'Pong!' });
  }
});

// エラーハンドリング
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// ボットをログイン
client.login(process.env.DISCORD_TOKEN);
```

### 6.2 ボット起動

```bash
# 開発モードで起動
npm run dev

# または本番モードで起動
npm start
```

### 6.3 Google Cloud Translation APIの動作確認

ESモジュールを使用した`src/translation-test.js`ファイルを作成：

```javascript
import 'dotenv/config';
import { TranslationServiceClient } from '@google-cloud/translate';

async function testTranslation() {
  try {
    // Translation APIクライアントの初期化
    const translationClient = new TranslationServiceClient();
    const projectId = process.env.GOOGLE_PROJECT_ID;
    const location = process.env.GOOGLE_LOCATION || 'global';
    
    // テスト用のテキスト
    const text = 'Hello, world!';
    
    // リクエスト設定
    const request = {
      parent: `projects/${projectId}/locations/${location}`,
      contents: [text],
      mimeType: 'text/plain',
      sourceLanguageCode: 'en',
      targetLanguageCode: 'ja',
    };
    
    // 翻訳実行
    console.log(`Translating text: "${text}"`);
    const [response] = await translationClient.translateText(request);
    console.log(`Translation result: "${response.translations[0].translatedText}"`);
    
    // 言語検出テスト
    const detectRequest = {
      parent: `projects/${projectId}/locations/${location}`,
      content: text,
      mimeType: 'text/plain',
    };
    
    console.log(`Detecting language for: "${text}"`);
    const [detectResponse] = await translationClient.detectLanguage(detectRequest);
    console.log('Language detection result:', detectResponse.languages);
    
    console.log('Translation API test completed successfully!');
  } catch (error) {
    console.error('Translation API test failed:', error);
  }
}

testTranslation();
```

テスト実行：

```bash
node src/translation-test.js
```

## 7. トラブルシューティング

### 7.1 Discord Bot関連の問題

- **ボットがオンラインにならない**: 
  - `.env`ファイルのトークンが正しいか確認
  - Intentsが正しく設定されているか確認
  - Discord Developer Portalでボットが有効化されているか確認
  - ボットトークンが漏洩していないか確認。漏洩している場合は再生成が必要

- **メッセージを受信できない**:
  - `MessageContent` Intentが有効化されているか確認
  - ボットがメッセージを読むための権限があるか確認
  - イベントハンドラが正しく設定されているか確認

- **スラッシュコマンドが表示されない**:
  - コマンド登録が成功しているか確認
  - `applications.commands`スコープが有効か確認
  - グローバルコマンドの場合、反映に1時間程度かかる場合があります

### 7.2 Google Cloud Translation API関連の問題

- **認証エラー**:
  - `GOOGLE_APPLICATION_CREDENTIALS`の環境変数が正しいパスを指しているか確認
  - サービスアカウントに適切な権限があるか確認
  - クレデンシャルファイルが有効か確認（有効期限切れの場合は再発行）

- **APIコール失敗**:
  - APIが有効化されているか確認
  - プロジェクトIDが正しいか確認
  - 請求情報が設定されているか確認（無料枠を使い切った場合）
  - レート制限に達していないか確認（短時間に多数のリクエストを送信した場合）

- **翻訳結果の品質問題**:
  - 言語コードが正しいか確認
  - 入力テキストの品質を確認（専門用語や俗語は翻訳精度が低下する場合あり）
  - 文脈不足による誤訳の場合は、より多くのコンテキストを提供することを検討

### 7.3 その他の一般的な問題

- **パッケージのインストールエラー**:
  ```bash
  rm -rf node_modules package-lock.json
  npm cache clean --force
  npm install
  ```

- **ESモジュール関連のエラー**:
  - `package.json`に`"type": "module"`が設定されているか確認
  - インポート文が正しいか確認（`require()`ではなく`import`を使用）
  - ファイル拡張子が`.mjs`または`.js`か確認

- **ファイルアクセス権限エラー**:
  - データディレクトリが存在し、書き込み権限があるか確認
  ```bash
  mkdir -p data
  chmod 755 data
  ```

---

これで2025年現在の開発環境構築とAPI設定は完了です。この環境をベースに、実装計画書に記載された機能開発を進めていくことができます。何か問題がある場合は、このトラブルシューティングセクションを参照するか、各サービスの公式ドキュメントを確認してください。 

# GCP（Google Cloud Platform）でTranDino Discordボットをホストする手順ガイド（2025年4月最新版）

---

## 目次
1. 概要
2. GCPプロジェクトの作成
3. 必要APIの有効化（2025年4月現在）
4. サービスアカウントと権限設定
5. デプロイ方法（Cloud Run推奨／Compute Engine補足）
6. 環境変数・シークレット管理
7. 永続化（データ/ログ）
8. 運用・監視・自動再起動
9. セキュリティの注意点
10. 参考リンク

---

## 1. 概要

TranDinoはNode.js製のDiscord翻訳ボットです。GCP上で24時間安定稼働させるには、
- Cloud Run（推奨：サーバーレス、スケーラブル、管理不要）
- Compute Engine（VM：自由度高いが運用負荷あり）
のいずれかでホストできます。

---

## 2. GCPプロジェクトの作成
1. [Google Cloud Console](https://console.cloud.google.com/)にアクセスし、プロジェクトを新規作成。
2. 請求先アカウントを紐付ける（無料枠あり）。

---

## 3. 必要APIの有効化（2025年4月現在）
- **Cloud Run Admin API**（旧Cloud Run API、2025年4月現在はこちらを有効化）
- **Cloud Translation API**（翻訳用）
- **Artifact Registry API**（Cloud RunでDockerイメージを使う場合）
- **Cloud Logging API, Cloud Monitoring API**（運用監視用）
- **Compute Engine API**（VM利用時のみ）

GCPコンソール「APIとサービス」→「APIとサービスの有効化」から検索して有効化してください。
- Cloud Run APIは「Cloud Run Admin API」として表示されます。
- 画像にある「Cloud Deploy API」や「GKE Multi-Cloud API」は本プロジェクトには不要です。

---

## 4. サービスアカウントと権限設定
- Cloud Run/Compute Engineで実行するサービスアカウントを作成。
- 必要なロール例：
  - Cloud Run Invoker
  - Cloud Run Admin（Cloud Runの管理が必要な場合）
  - Storage Object Viewer（永続化が必要な場合）
  - Cloud Translation API User
- サービスアカウントキー（JSON）は**.envやコードに直書きせず、GCPのSecret Managerや環境変数で安全に管理**。
- Cloud Runの場合、サービスアカウントキーを使わずに「サービスアカウントの割り当て」＋「Secret Manager連携」でセキュアに運用するのが推奨です。

---

## 5. デプロイ方法

### 5.1 Cloud Run（推奨）
#### a. Dockerfileの用意
プロジェクトルートに以下のようなDockerfileを作成：
```Dockerfile
FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["npm", "start"]
```
- 2025年現在、`npm ci --omit=dev`で本番用依存のみインストールが推奨です。

#### b. イメージビルド＆デプロイ
Cloud Shellまたはローカルで：
```bash
gcloud builds submit --tag gcr.io/<YOUR_PROJECT_ID>/trandino-bot
```

```bash
gcloud run deploy trandino-bot \
  --image gcr.io/<YOUR_PROJECT_ID>/trandino-bot \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --service-account <サービスアカウントメール> \
  --set-secrets DISCORD_TOKEN=projects/<PROJECT_NUM>/secrets/DISCORD_TOKEN:latest,GOOGLE_APPLICATION_CREDENTIALS=projects/<PROJECT_NUM>/secrets/GOOGLE_APPLICATION_CREDENTIALS:latest
```
- 環境変数は`--set-env-vars`またはSecret Manager連携（`--set-secrets`）で渡します。
- DiscordトークンやGoogle認証情報はSecret Managerで管理し、直接環境変数やファイルで渡さないのが推奨です。
- `--allow-unauthenticated`は外部からのアクセスを許可（Bot用途ならOK）。

#### c. ポート番号
Cloud Runはデフォルトで`PORT`環境変数を渡しますが、Discord Botは外部HTTPリクエストを受けないため、特別なWebhook等がなければNode.js側でlisten不要です。

### 5.2 Compute Engine（VM）
1. インスタンス作成（Ubuntu 22.04 LTS等、e2-microでOK）
2. SSHでログインし、Node.js, npm, gitをインストール
3. リポジトリをcloneし、`npm ci`、`.env`またはSecret Manager連携を設定
4. `npm start`で起動
5. `pm2`や`systemd`でプロセスを常駐化

---

## 6. 環境変数・シークレット管理
- Cloud Runの場合：[Secret Manager](https://cloud.google.com/secret-manager)と連携し、`--set-secrets`で渡すのが推奨
- Compute Engineの場合：`.env`ファイルをサーバーに安全に配置、またはSecret Manager連携
- **APIキーやトークンは絶対にGit等で公開しないこと**

---

## 7. 永続化（データ/ログ）
- `data/`や`logs/`ディレクトリを永続化したい場合、Cloud Storageバケットと連携するか、Compute Engineの永続ディスクを利用
- Cloud Runはステートレスなので、永続データはCloud Storage等に保存する設計が推奨
- ログはCloud Loggingに自動送信されます

---

## 8. 運用・監視・自動再起動
- Cloud Run/Compute EngineともにCloud Logging/Monitoringでログ・メトリクス監視が可能
- Compute Engineの場合は`pm2`や`systemd`で自動再起動設定推奨
- Cloud Runは自動スケール・自動再起動
- 必要に応じてアラートポリシーを設定

---

## 9. セキュリティの注意点
- APIキー・トークンはSecret Managerや環境変数で安全に管理
- Discord Botの権限は最小限に
- GCP IAMロールも最小権限で
- 外部公開する場合はファイアウォールや認証設定も検討
- サービスアカウントの権限は必要最小限に

---

## 10. 参考リンク
- [Google Cloud公式: Node.jsアプリのCloud Runデプロイ](https://cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-nodejs-service)
- [Google Cloud公式: Compute EngineでNode.jsアプリを動かす](https://cloud.google.com/compute/docs/instances/)
- [Secret Managerの使い方](https://cloud.google.com/secret-manager/docs/creating-and-accessing-secrets)
- [Cloud Translation APIの有効化](https://console.cloud.google.com/apis/library/translate.googleapis.com)
- [Discord Bot公式ドキュメント](https://discord.com/developers/docs/intro)

---

このガイドは2024年7月時点の情報を元にしています。GCPの仕様変更等があれば公式ドキュメントもご参照ください。 