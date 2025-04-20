import logger from './logger.js';

/**
 * @typedef {Object} LanguageCacheConfig
 * @property {number} maxSize - キャッシュの最大エントリ数
 * @property {number} ttl - エントリの有効期限（ミリ秒）
 * @property {number} confidenceThreshold - 信頼度のしきい値
 */

/**
 * 言語検出結果をキャッシュするクラス
 * テキストの言語検出結果をキャッシュして再利用性を高める
 */
export class LanguageCache {
  constructor(cacheConfig) {
    // キャッシュのメインストレージ
    this.cache = new Map();
    
    // キャッシュサイズの最大値
    this.maxSize = cacheConfig?.maxSize || 2000;
    
    // キャッシュアイテムのTTL (ミリ秒)
    this.ttl = cacheConfig?.ttl || 7 * 24 * 60 * 60 * 1000; // デフォルト7日間
    
    // 信頼度のしきい値
    this.confidenceThreshold = cacheConfig?.confidenceThreshold || 0.8;
    
    // 最近アクセスした順にキーを保持する配列
    this.recentlyUsed = [];
    
    // 定期的にキャッシュをクリーンアップするためのインターバル
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 60 * 60 * 1000); // 1時間ごと
    
    logger.info(`言語検出キャッシュを初期化しました (最大サイズ: ${this.maxSize}, TTL: ${this.ttl / (24 * 60 * 60 * 1000)}日, 信頼度しきい値: ${this.confidenceThreshold})`);
  }
  
  /**
   * キャッシュキーを生成する
   * @param {string} text - 言語を検出するテキスト
   * @returns {string} キャッシュキー
   */
  generateKey(text) {
    // テキストが長い場合は先頭のみを使用してキーを短くする
    const truncatedText = text.length > 100 ? text.substring(0, 100) : text;
    return truncatedText;
  }
  
  /**
   * キャッシュから言語検出結果を取得する
   * @param {string} text - 言語を検出するテキスト
   * @returns {Object|null} キャッシュされた言語検出結果、なければnull
   */
  get(text) {
    const key = this.generateKey(text);
    
    if (!this.cache.has(key)) {
      return null;
    }
    
    const entry = this.cache.get(key);
    
    // 期限切れの場合はnullを返す
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.recentlyUsed = this.recentlyUsed.filter(k => k !== key);
      return null;
    }
    
    // 最近使用したアイテムリストを更新
    this.updateRecentlyUsed(key);
    
    // アクセス時間を更新
    entry.lastAccessed = Date.now();
    this.cache.set(key, entry);
    
    return {
      language: entry.language,
      confidence: entry.confidence,
      fromCache: true
    };
  }
  
  /**
   * 言語検出結果をキャッシュに保存する
   * @param {string} text - 言語を検出したテキスト
   * @param {Object} result - 検出結果オブジェクト
   * @param {string} result.language - 検出された言語コード
   * @param {number} result.confidence - 言語検出の信頼度
   */
  set(text, result) {
    // 信頼度がしきい値より低い場合はキャッシュしない
    if (result.confidence < this.confidenceThreshold) {
      logger.debug(`信頼度が低いため言語検出結果をキャッシュしません (${result.language}, ${result.confidence})`);
      return;
    }
    
    const key = this.generateKey(text);
    
    // キャッシュサイズが上限に達した場合、最も古いアイテムを削除
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    // キャッシュエントリを作成
    const entry = {
      text: text.substring(0, 100), // 元テキストの一部のみを保存する
      language: result.language,
      confidence: result.confidence,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: Date.now() + this.ttl
    };
    
    this.cache.set(key, entry);
    this.updateRecentlyUsed(key);
    
    logger.debug(`言語検出結果をキャッシュしました: ${result.language} (信頼度: ${result.confidence})`);
  }
  
  /**
   * 最も古いキャッシュエントリを削除する
   */
  evictOldest() {
    if (this.recentlyUsed.length === 0) return;
    
    // 最後に使用されたキーを取得して削除
    const oldestKey = this.recentlyUsed.pop();
    this.cache.delete(oldestKey);
    
    logger.debug('古い言語検出キャッシュエントリを削除しました');
  }
  
  /**
   * 最近使用したアイテムリストを更新
   * @param {string} key - 更新するキャッシュキー
   */
  updateRecentlyUsed(key) {
    // 既存のキーを削除
    this.recentlyUsed = this.recentlyUsed.filter(k => k !== key);
    
    // リストの先頭に追加
    this.recentlyUsed.unshift(key);
  }
  
  /**
   * 期限切れのキャッシュエントリをクリーンアップ
   */
  cleanupExpired() {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        this.recentlyUsed = this.recentlyUsed.filter(k => k !== key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      logger.debug(`期限切れの言語検出キャッシュエントリを${expiredCount}件削除しました`);
    }
  }
  
  /**
   * キャッシュを完全にクリアする
   */
  clear() {
    this.cache.clear();
    this.recentlyUsed = [];
    logger.info('言語検出キャッシュをクリアしました');
  }
  
  /**
   * キャッシュの統計情報を取得
   * @returns {Object} キャッシュ統計情報
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlDays: this.ttl / (24 * 60 * 60 * 1000),
      confidenceThreshold: this.confidenceThreshold
    };
  }
} 