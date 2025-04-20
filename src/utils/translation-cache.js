import logger from './logger.js';
// import config from '../config/config.js'; // 削除

/**
 * 翻訳結果をキャッシュするクラス
 * 言語間翻訳の結果をキャッシュして再利用性を高める
 */
export class TranslationCache { // 名前付きエクスポートに変更
  constructor(cacheConfig) { // コンストラクタで設定を受け取る
    // キャッシュのメインストレージ
    this.cache = new Map();
    
    // キャッシュサイズの最大値
    this.maxSize = cacheConfig?.maxSize || 1000; // 受け取った設定を使用
    
    // キャッシュアイテムのTTL (ミリ秒)
    this.ttl = cacheConfig?.ttl || 24 * 60 * 60 * 1000; // 受け取った設定を使用
    
    // 最近アクセスした順にキーを保持する配列
    this.recentlyUsed = [];
    
    // 定期的にキャッシュをクリーンアップするためのインターバル
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 30 * 60 * 1000); // 30分ごと
    
    logger.info(`翻訳キャッシュを初期化しました (最大サイズ: ${this.maxSize}, TTL: ${this.ttl / (60 * 60 * 1000)}時間)`);
  }
  
  /**
   * キャッシュキーを生成する
   * @param {string} text - 元のテキスト
   * @param {string} sourceLanguage - 翻訳元の言語
   * @param {string} targetLanguage - 翻訳先の言語
   * @returns {string} キャッシュキー
   */
  generateKey(text, sourceLanguage, targetLanguage) {
    // テキストが長い場合は先頭のみを使用してキーを短くする
    const truncatedText = text.length > 50 ? text.substring(0, 50) : text;
    return `${truncatedText}|${sourceLanguage}|${targetLanguage}`;
  }
  
  /**
   * キャッシュから翻訳結果を取得する
   * @param {string} text - 元のテキスト
   * @param {string} sourceLanguage - 翻訳元の言語
   * @param {string} targetLanguage - 翻訳先の言語
   * @returns {string|null} キャッシュされた翻訳テキスト、なければnull
   */
  get(text, sourceLanguage, targetLanguage) {
    const key = this.generateKey(text, sourceLanguage, targetLanguage);
    
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
    
    return entry.translatedText;
  }
  
  /**
   * 翻訳結果をキャッシュに保存する
   * @param {string} text - 元のテキスト
   * @param {string} sourceLanguage - 翻訳元の言語
   * @param {string} targetLanguage - 翻訳先の言語
   * @param {string} translatedText - 翻訳されたテキスト
   */
  set(text, sourceLanguage, targetLanguage, translatedText) {
    const key = this.generateKey(text, sourceLanguage, targetLanguage);
    
    // キャッシュサイズが上限に達した場合、最も古いアイテムを削除
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    // キャッシュエントリを作成
    const entry = {
      text,
      sourceLanguage,
      targetLanguage,
      translatedText,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: Date.now() + this.ttl
    };
    
    this.cache.set(key, entry);
    this.updateRecentlyUsed(key);
  }
  
  /**
   * 最も古いキャッシュエントリを削除する
   */
  evictOldest() {
    if (this.recentlyUsed.length === 0) return;
    
    // 最後に使用されたキーを取得して削除
    const oldestKey = this.recentlyUsed.pop();
    this.cache.delete(oldestKey);
    
    logger.debug(`古いキャッシュエントリを削除しました: ${oldestKey}`);
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
      logger.debug(`期限切れのキャッシュエントリを${expiredCount}件削除しました`);
    }
  }
  
  /**
   * キャッシュを完全にクリアする
   */
  clear() {
    this.cache.clear();
    this.recentlyUsed = [];
    logger.info('翻訳キャッシュをクリアしました');
  }
  
  /**
   * キャッシュの統計情報を取得
   * @returns {Object} キャッシュ統計情報
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlHours: this.ttl / (60 * 60 * 1000)
    };
  }
} 