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
    
    // スラッシュコマンド処理
    this.client.on(Events.InteractionCreate, this.handleInteraction.bind(this));
  }

  /**
   * 受信したメッセージを処理する
   * @param {Object} message - Discordメッセージオブジェクト
   */
  async handleMessage(message) {
    // 自分のメッセージやBotのメッセージは処理しない
    if (message.author.bot) return;
    
    // DMは処理しない
    if (!message.guild) {
      logger.debug('DMは処理しません', { userId: message.author.id });
      return;
    }
    
    try {
      const guildId = message.guild.id;
      // settingsServiceではなくchannelManagerを使用
      const guildSettings = await this.channelManager.getGuildSettings(guildId);
      
      // 翻訳先チャンネルが設定されていない場合は処理しない
      if (!guildSettings.targetChannelId) {
        logger.debug('翻訳先チャンネルが設定されていません', { guildId });
        return;
      }
      
      // 翻訳先チャンネルがソースチャンネルと同じ場合は処理しない
      if (message.channel.id === guildSettings.targetChannelId) {
        logger.debug('ソースチャンネルと翻訳先チャンネルが同じため処理しません', { channelId: message.channel.id });
        return;
      }
      
      const content = message.content;
      
      // 空のメッセージは処理しない
      if (!content || content.trim() === '') {
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
      
      // 検出された言語が翻訳対象外の場合は処理しない
      if (!guildSettings.translateFrom.includes(detectedLanguage) && 
          guildSettings.translateFrom.length > 0) {
        logger.debug('検出された言語は翻訳対象外です', { 
          language: detectedLanguage, 
          allowedLanguages: guildSettings.translateFrom 
        });
        return;
      }
      
      // 信頼度が低い場合は処理しない
      if (confidence < guildSettings.minConfidence) {
        logger.debug('言語検出の信頼度が低いため処理しません', { 
          confidence, 
          minConfidence: guildSettings.minConfidence 
        });
        return;
      }
      
      // 翻訳先の言語
      const targetLanguage = guildSettings.targetLanguage;
      
      // 検出された言語が翻訳先言語と同じ場合は処理しない
      if (detectedLanguage === targetLanguage) {
        logger.debug('検出された言語が翻訳先言語と同じため処理しません', { 
          language: detectedLanguage, 
          targetLanguage 
        });
        return;
      }
      
      // 翻訳実行
      const startTranslation = performance.now();
      const translationResult = await this.translationService.translateText(
        content, 
        detectedLanguage, 
        targetLanguage
      );
      const translationTime = performance.now() - startTranslation;
      
      logger.info('翻訳実行', { 
        sourceLanguage: detectedLanguage, 
        targetLanguage, 
        messageId: message.id, 
        timeMs: translationTime.toFixed(2),
        fromCache: translationResult.fromCache 
      });
      
      // 翻訳先チャンネルを取得
      const targetChannel = await this.client.channels.fetch(guildSettings.targetChannelId);
      if (!targetChannel) {
        logger.error('翻訳先チャンネルが見つかりません', { channelId: guildSettings.targetChannelId });
        return;
      }
      
      // 翻訳結果を送信
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
      
      await targetChannel.send(formattedMessage);
      
      // 成功したことをログに記録
      logger.info('翻訳メッセージを送信しました', { 
        sourceChannelId: message.channel.id, 
        targetChannelId: targetChannel.id, 
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
