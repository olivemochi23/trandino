import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';

/**
 * チャンネル管理クラス
 * 翻訳対象チャンネルの設定を管理する
 */
export class ChannelManager {
  /**
   * チャンネル管理を初期化する
   * @param {Object} config - ストレージ設定
   */
  constructor(config = {}) {
    this.dataDir = config.dataDir || process.env.DATA_DIR || './data';
    this.configPath = path.join(this.dataDir, 'channels.json');
    
    // データディレクトリの初期化を行う
    this.initializeDataDir();
  }
  
  /**
   * データディレクトリを初期化する
   */
  async initializeDataDir() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      logger.info(`データディレクトリを作成しました: ${this.dataDir}`);
    } catch (error) {
      logger.error('データディレクトリの作成に失敗しました:', { error });
    }
  }
  
  /**
   * 設定を読み込む
   * @returns {Promise<Object>} チャンネル設定
   */
  async loadConfig() {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // ファイルが存在しない場合は空のオブジェクトを返す
        logger.info('チャンネル設定ファイルが存在しないため、新規に作成します');
        
        // 空の設定ファイルを作成
        await this.saveConfig({});
        
        return {};
      }
      logger.error('チャンネル設定の読み込みに失敗しました:', { error, path: this.configPath });
      throw error;
    }
  }
  
  /**
   * 設定を保存する
   * @param {Object} config - 保存する設定
   */
  async saveConfig(config) {
    try {
      // ディレクトリが存在することを再確認
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
      logger.debug('チャンネル設定を保存しました', { path: this.configPath });
      
      return true;
    } catch (error) {
      logger.error('チャンネル設定の保存に失敗しました:', { error, path: this.configPath });
      throw error;
    }
  }
  
  /**
   * チャンネルが翻訳対象かどうかを確認する
   * @param {string} guildId - サーバーID
   * @param {string} channelId - チャンネルID
   * @returns {Promise<boolean>} 翻訳対象の場合はtrue
   */
  async isEnabledChannel(guildId, channelId) {
    try {
      if (!guildId || !channelId) {
        logger.warn('無効なパラメータでisEnabledChannelが呼び出されました', { guildId, channelId });
        return false;
      }
      
      const config = await this.loadConfig();
      const guildConfig = config[guildId];
      
      if (!guildConfig || !guildConfig.enabled) {
        return false;
      }
      
      return Array.isArray(guildConfig.channels) && guildConfig.channels.includes(channelId);
    } catch (error) {
      logger.error('チャンネル確認中にエラーが発生しました:', { error, guildId, channelId });
      return false;
    }
  }
  
  /**
   * サーバーの有効なチャンネル一覧を取得する
   * @param {string} guildId - サーバーID
   * @returns {Promise<Array<string>>} 有効なチャンネルIDの配列
   */
  async getEnabledChannels(guildId) {
    try {
      if (!guildId) {
        logger.warn('無効なパラメータでgetEnabledChannelsが呼び出されました', { guildId });
        return [];
      }
      
      const config = await this.loadConfig();
      const guildConfig = config[guildId];
      
      if (!guildConfig || !guildConfig.enabled) {
        return [];
      }
      
      return Array.isArray(guildConfig.channels) ? guildConfig.channels : [];
    } catch (error) {
      logger.error('有効チャンネル取得中にエラーが発生しました:', { error, guildId });
      return [];
    }
  }
  
  /**
   * サーバーの設定を取得する
   * @param {string} guildId - サーバーID
   * @returns {Promise<Object>} サーバー設定オブジェクト
   */
  async getGuildSettings(guildId) {
    try {
      const config = await this.loadConfig();
      const guildConfig = config[guildId];

      // デフォルト設定
      const defaultSettings = {
        targetChannelId: null, // 翻訳先チャンネルID (要設定)
        translateFrom: [],     // 翻訳元言語リスト (空の場合は全言語)
        minConfidence: 0.7,    // 信頼度の最低値
        enabledChannels: []    // 有効なチャンネルリスト
      };

      if (!guildConfig) {
        logger.debug(`サーバー設定が見つかりません。デフォルト設定を返します。`, { guildId });
        return defaultSettings;
      }

      // 保存されている設定とデフォルト設定をマージ
      return {
        targetChannelId: guildConfig.targetChannelId || defaultSettings.targetChannelId,
        translateFrom: guildConfig.translateFrom || defaultSettings.translateFrom,
        minConfidence: guildConfig.minConfidence !== undefined ? guildConfig.minConfidence : defaultSettings.minConfidence,
        enabledChannels: Array.isArray(guildConfig.channels) ? guildConfig.channels : defaultSettings.enabledChannels
      };

    } catch (error) {
      logger.error('サーバー設定取得中にエラーが発生しました:', { error, guildId });
      // エラー時もデフォルト設定を返す
      return {
        targetChannelId: null,
        translateFrom: [],
        minConfidence: 0.7,
        enabledChannels: []
      };
    }
  }
  
  /**
   * チャンネルを追加する
   * @param {string} guildId - サーバーID
   * @param {string} channelId - チャンネルID
   * @param {string} userId - 更新したユーザーID
   * @returns {Promise<Object>} 更新された設定
   */
  async addChannel(guildId, channelId, userId) {
    try {
      if (!guildId || !channelId || !userId) {
        logger.warn('無効なパラメータでaddChannelが呼び出されました', { guildId, channelId, userId });
        throw new Error('サーバーID、チャンネルID、ユーザーIDは必須です');
      }
      
      const config = await this.loadConfig();
      
      if (!config[guildId]) {
        config[guildId] = {
          channels: [],
          enabled: true,
          last_updated: new Date().toISOString(),
          updated_by: userId
        };
      }
      
      // チャンネル配列が未定義の場合は初期化
      if (!Array.isArray(config[guildId].channels)) {
        config[guildId].channels = [];
      }
      
      if (!config[guildId].channels.includes(channelId)) {
        config[guildId].channels.push(channelId);
        config[guildId].last_updated = new Date().toISOString();
        config[guildId].updated_by = userId;
        
        logger.info('チャンネルを追加しました', { guildId, channelId, userId });
      } else {
        logger.debug('チャンネルは既に追加されています', { guildId, channelId });
      }
      
      await this.saveConfig(config);
      return config[guildId];
    } catch (error) {
      logger.error('チャンネル追加中にエラーが発生しました:', { error, guildId, channelId });
      throw error;
    }
  }
  
  /**
   * チャンネルを削除する
   * @param {string} guildId - サーバーID
   * @param {string} channelId - チャンネルID
   * @param {string} userId - 更新したユーザーID
   * @returns {Promise<Object>} 更新された設定
   */
  async removeChannel(guildId, channelId, userId) {
    try {
      if (!guildId || !channelId || !userId) {
        logger.warn('無効なパラメータでremoveChannelが呼び出されました', { guildId, channelId, userId });
        throw new Error('サーバーID、チャンネルID、ユーザーIDは必須です');
      }
      
      const config = await this.loadConfig();
      
      if (!config[guildId]) {
        logger.debug('サーバー設定が存在しません', { guildId });
        return null;
      }
      
      // チャンネル配列が未定義の場合は初期化
      if (!Array.isArray(config[guildId].channels)) {
        config[guildId].channels = [];
        logger.warn('無効なチャンネル配列を検出、初期化しました', { guildId });
      }
      
      const initialCount = config[guildId].channels.length;
      config[guildId].channels = config[guildId].channels.filter(id => id !== channelId);
      
      if (config[guildId].channels.length < initialCount) {
        config[guildId].last_updated = new Date().toISOString();
        config[guildId].updated_by = userId;
        logger.info('チャンネルを削除しました', { guildId, channelId, userId });
      } else {
        logger.debug('削除対象のチャンネルが見つかりませんでした', { guildId, channelId });
      }
      
      await this.saveConfig(config);
      return config[guildId];
    } catch (error) {
      logger.error('チャンネル削除中にエラーが発生しました:', { error, guildId, channelId });
      throw error;
    }
  }
} 