import { Client, GatewayIntentBits, Partials, Collection, Events } from 'discord.js';
import { TranslationService } from './services/translation-service.js';
import { ChannelManager } from './services/channel-manager.js';
import logger from './utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import performanceMonitor from './utils/performance-monitor.js';

// ES Moduleでの __dirname相当の対応
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Discord翻訳ボットのメインクラス
 */
export class Bot {
  /**
   * ボットを初期化する
   * @param {Object} config - ボット設定
   */
  constructor(config) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel, Partials.Message],
    });

    // サービスの初期化
    // configオブジェクトからそれぞれのサービスに必要な部分を渡す
    this.translationService = new TranslationService(config.translation, performanceMonitor);
    this.channelManager = new ChannelManager(config.storage);
    
    // コマンドコレクション
    this.commands = new Collection();
    
    // コマンドの読み込み
    this.loadCommands();

    // イベントハンドラの設定
    this.setupEventHandlers();
  }
  
  /**
   * コマンドを読み込む
   */
  async loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    
    try {
      // コマンドディレクトリが存在するか確認
      if (!fs.existsSync(commandsPath)) {
        logger.warn('コマンドディレクトリが存在しません:', { path: commandsPath });
        return;
      }
      
      const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
      
      for (const file of commandFiles) {
        try {
          const filePath = path.join(commandsPath, file);
          // ファイルURLへ変換（Windowsでの互換性対応）
          const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
          const command = await import(fileUrl);
          
          // コマンドにdata, executeプロパティがあることを確認
          if ('data' in command && 'execute' in command) {
            this.commands.set(command.data.name, command);
            logger.debug(`コマンドを読み込みました: ${command.data.name}`);
          } else {
            logger.warn(`無効なコマンドです: ${file}`, { 
              hasData: 'data' in command, 
              hasExecute: 'execute' in command 
            });
          }
        } catch (error) {
          logger.error(`コマンド読み込み中にエラーが発生しました: ${file}`, { error });
        }
      }
      
      logger.info(`${this.commands.size}個のコマンドを読み込みました`);
    } catch (error) {
      logger.error('コマンド読み込み処理中にエラーが発生しました', { error });
    }
  }

  /**
   * イベントハンドラを設定する
   */
  setupEventHandlers() {
    // 準備完了時
    this.client.once(Events.ClientReady, () => {
      logger.info(`ログイン完了: ${this.client.user.tag}`);
    });

    // エラー発生時
    this.client.on(Events.Error, (error) => {
      logger.error('Discordクライアントエラー:', { error });
    });

    // メッセージ受信時
    this.client.on(Events.MessageCreate, this.handleMessage.bind(this));
    // メッセージ編集時（追加）
    this.client.on(Events.MessageUpdate, this.handleMessageUpdate.bind(this));
    // スラッシュコマンド処理
    this.client.on(Events.InteractionCreate, this.handleInteraction.bind(this));
  }

  /**
   * 受信したメッセージを処理する
   * @param {Object} message - Discordメッセージオブジェクト
   */
  async handleMessage(message) {
    // 自分自身のメッセージは処理しない
    if (message.author.id === this.client.user.id) return;
    
    // DMは処理しない
    if (!message.guild) {
      logger.debug('DMは処理しません', { userId: message.author.id });
      return;
    }
    
    try {
      const guildId = message.guild.id;
      const channelId = message.channel.id;
      // 翻訳対象チャンネルかチェック
      const isEnabled = await this.channelManager.isEnabledChannel(guildId, channelId);
      if (!isEnabled) {
        logger.debug('翻訳対象チャンネルではありません', { guildId, channelId });
        return;
      }
      
      // contentが空でもembedからテキスト抽出
      let content = message.content;
      if ((!content || !content.trim()) && message.embeds.length > 0) {
        // 最初のembedのdescriptionやfieldsからテキストを抽出
        const embed = message.embeds[0];
        content = embed.description || '';
        if (embed.fields && embed.fields.length > 0) {
          content += '\n' + embed.fields.map(f => f.value).join('\n');
        }
      }
      // 空のメッセージは処理しない
      if (!content || !content.trim()) {
        logger.debug('空のメッセージは処理しません', { messageId: message.id });
        return;
      }
      
      // 言語検出実行
      const detectionResult = await this.translationService.detectLanguage(content);
      const detectedLanguage = detectionResult.language;
      const confidence = detectionResult.confidence;
      const languageFromCache = detectionResult.fromCache;
      
      logger.info('言語検出結果', { 
        language: detectedLanguage, 
        confidence, 
        messageId: message.id,
        fromCache: languageFromCache 
      });
      // 日本語の場合は翻訳不要
      if (detectedLanguage === this.translationService.defaultTargetLanguage) {
        logger.debug('検出された言語がデフォルト対象言語と同じため処理しません', { language: detectedLanguage });
        return;
      }
      // 信頼度が低い場合は処理しない
      if (confidence < 0.7) {
        logger.debug('言語検出の信頼度が低いため処理しません', { confidence });
        return;
      }
      // 翻訳実行 (デフォルトターゲット言語へ変換)
      const startTranslation = performance.now();
      const translationResult = await this.translationService.translateText(
        content,
        this.translationService.defaultTargetLanguage,
        detectedLanguage
      );
      const translationTime = performance.now() - startTranslation;
      
      logger.info('翻訳実行', { 
        sourceLanguage: this.translationService.defaultTargetLanguage, 
        targetLanguage: detectedLanguage, 
        messageId: message.id, 
        timeMs: translationTime.toFixed(2),
        fromCache: translationResult.fromCache 
      });
      
      // 翻訳結果を送信（同一チャンネル）
      const result = {
        sourceLanguage: detectedLanguage,
        translatedText: translationResult.translatedText,
        confidence: confidence,
        fromCache: translationResult.fromCache,
        languageFromCache: languageFromCache
      };
      
      const formattedMessage = this.translationService.formatTranslationResult(content, result);
      
      // 著者情報を追加
      const username = message.member?.displayName || message.author.username;
      const userAvatar = message.author.displayAvatarURL({ dynamic: true });
      
      // 埋め込みメッセージに著者情報を追加
      formattedMessage.embeds[0].author = {
        name: username,
        icon_url: userAvatar
      };
      
      // 添付ファイルがある場合は、最初の画像を埋め込みに追加
      if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        if (attachment.contentType?.startsWith('image/')) {
          formattedMessage.embeds[0].image = { url: attachment.url };
        }
      }
      
      await message.channel.send(formattedMessage);
      
      // 成功したことをログに記録
      logger.info('翻訳メッセージを送信しました', { 
        channelId: message.channel.id, 
        messageId: message.id 
      });
    } catch (error) {
      logger.error('メッセージ処理中にエラーが発生しました', { 
        error: error.message, 
        stack: error.stack, 
        messageId: message.id 
      });
    }
  }
  
  /**
   * メッセージ編集時の処理
   * @param {Object} oldMessage - 編集前のメッセージ
   * @param {Object} newMessage - 編集後のメッセージ
   */
  async handleMessageUpdate(oldMessage, newMessage) {
    // partialの場合はfetch
    if (newMessage.partial) {
      try {
        newMessage = await newMessage.fetch();
      } catch (e) {
        logger.error('メッセージのfetchに失敗', { error: e });
        return;
      }
    }
    // 通常のメッセージ処理と同じロジックを使う
    await this.handleMessage(newMessage);
  }
  
  /**
   * インタラクションを処理する
   * @param {Interaction} interaction - 受信したインタラクション
   */
  async handleInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return;
    
    const command = this.commands.get(interaction.commandName);
    
    if (!command) {
      logger.warn(`未実装のコマンドが実行されました: ${interaction.commandName}`);
      return;
    }
    
    try {
      // コマンドの実行
      await command.execute(interaction, {
        channelManager: this.channelManager,
        translationService: this.translationService
      });
      
      logger.info(`コマンドが実行されました: ${interaction.commandName}`, {
        user: interaction.user.tag,
        guild: interaction.guild?.name
      });
    } catch (error) {
      logger.error(`コマンド実行中にエラーが発生しました: ${interaction.commandName}`, { error });
      
      // エラー応答
      const errorMessage = '申し訳ありません、コマンドの実行中にエラーが発生しました。';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }

  /**
   * ボットを起動する
   */
  async start() {
    try {
      await this.client.login(this.config.token);
      logger.info('ボットの起動が完了しました');
    } catch (error) {
      logger.error('ボットの起動に失敗しました:', { error });
      process.exit(1);
    }
  }
}
