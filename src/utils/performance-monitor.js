import logger from './logger.js';

/**
 * パフォーマンスモニターオプション
 * @typedef {Object} PerformanceMonitorOptions
 * @property {number} historyLimit - 保持する履歴の最大数
 * @property {number} logInterval - ログ出力間隔（ミリ秒）
 */

/**
 * パフォーマンスモニタークラス
 * API呼び出しなどのパフォーマンスを監視し、統計を提供します
 */
class PerformanceMonitor {
  constructor() {
    // 翻訳API関連の統計
    this.translationStats = {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      cacheHits: 0,
      cacheMisses: 0,
      lastUpdated: new Date()
    };

    // 言語検出API関連の統計
    this.languageDetectionStats = {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      lastUpdated: new Date()
    };

    // 設定
    this.config = {
      historyLimit: 1000,  // 直近1000件のレスポンスタイムを保持
      logInterval: 3600000 // 1時間ごとにログ出力
    };

    // 定期ログ出力の設定
    this.setupPeriodicLogging();

    // apiStatsの親オブジェクト参照を設定
    this.apiStats.translate.parent = this;
    this.apiStats.detect.parent = this;
  }

  /**
   * 設定を更新する
   * @param {PerformanceMonitorOptions} options - 設定オプション
   */
  configure(options = {}) {
    this.config = {
      ...this.config,
      ...options
    };
  }

  /**
   * 翻訳リクエストを記録する
   * @param {boolean} success - リクエストが成功したかどうか
   * @param {number} responseTime - レスポンス時間（ミリ秒）
   * @param {boolean} fromCache - キャッシュからの取得かどうか
   */
  recordTranslationRequest(success, responseTime, fromCache = false) {
    this.translationStats.totalRequests++;
    this.apiStats.translate.totalCalls++;
    this.translationStats.lastUpdated = new Date();
    
    if (fromCache) {
      this.translationStats.cacheHits++;
      return; // キャッシュヒットの場合は他の統計は更新しない
    } else {
      this.translationStats.cacheMisses++;
    }

    if (success) {
      this.translationStats.successRequests++;
      
      // レスポンスタイムの記録
      this.translationStats.responseTimes.push(responseTime);
      if (this.translationStats.responseTimes.length > this.config.historyLimit) {
        this.translationStats.responseTimes.shift(); // 古いデータを削除
      }
    } else {
      this.translationStats.failedRequests++;
    }
  }

  /**
   * 言語検出リクエストを記録する
   * @param {boolean} success - リクエストが成功したかどうか
   * @param {number} responseTime - レスポンス時間（ミリ秒）
   */
  recordLanguageDetectionRequest(success, responseTime) {
    this.languageDetectionStats.totalRequests++;
    this.apiStats.detect.totalCalls++;
    this.languageDetectionStats.lastUpdated = new Date();
    
    if (success) {
      this.languageDetectionStats.successRequests++;
      
      // レスポンスタイムの記録
      this.languageDetectionStats.responseTimes.push(responseTime);
      if (this.languageDetectionStats.responseTimes.length > this.config.historyLimit) {
        this.languageDetectionStats.responseTimes.shift(); // 古いデータを削除
      }
    } else {
      this.languageDetectionStats.failedRequests++;
    }
  }

  /**
   * 翻訳APIの成功率を取得する
   * @returns {number} 成功率（0～100）
   */
  getTranslationSuccessRate() {
    if (this.translationStats.totalRequests === 0) return 100;
    return (this.translationStats.successRequests / (this.translationStats.successRequests + this.translationStats.failedRequests)) * 100;
  }

  /**
   * 言語検出APIの成功率を取得する
   * @returns {number} 成功率（0～100）
   */
  getLanguageDetectionSuccessRate() {
    if (this.languageDetectionStats.totalRequests === 0) return 100;
    return (this.languageDetectionStats.successRequests / (this.languageDetectionStats.successRequests + this.languageDetectionStats.failedRequests)) * 100;
  }

  /**
   * 翻訳APIの平均レスポンス時間を取得する
   * @returns {number} 平均レスポンス時間（ミリ秒）
   */
  getAverageTranslationResponseTime() {
    if (this.translationStats.responseTimes.length === 0) return 0;
    const sum = this.translationStats.responseTimes.reduce((a, b) => a + b, 0);
    return sum / this.translationStats.responseTimes.length;
  }

  /**
   * 言語検出APIの平均レスポンス時間を取得する
   * @returns {number} 平均レスポンス時間（ミリ秒）
   */
  getAverageLanguageDetectionResponseTime() {
    if (this.languageDetectionStats.responseTimes.length === 0) return 0;
    const sum = this.languageDetectionStats.responseTimes.reduce((a, b) => a + b, 0);
    return sum / this.languageDetectionStats.responseTimes.length;
  }

  /**
   * キャッシュヒット率を取得する
   * @returns {number} キャッシュヒット率（0～100）
   */
  getCacheHitRate() {
    const total = this.translationStats.cacheHits + this.translationStats.cacheMisses;
    if (total === 0) return 0;
    return (this.translationStats.cacheHits / total) * 100;
  }

  /**
   * すべての統計情報を取得する
   * @returns {Object} 統計情報
   */
  getStats() {
    return {
      translation: {
        totalRequests: this.translationStats.totalRequests,
        successRate: this.getTranslationSuccessRate(),
        averageResponseTime: this.getAverageTranslationResponseTime(),
        cacheHitRate: this.getCacheHitRate(),
        lastUpdated: this.translationStats.lastUpdated
      },
      languageDetection: {
        totalRequests: this.languageDetectionStats.totalRequests,
        successRate: this.getLanguageDetectionSuccessRate(),
        averageResponseTime: this.getAverageLanguageDetectionResponseTime(),
        lastUpdated: this.languageDetectionStats.lastUpdated
      }
    };
  }

  /**
   * 統計情報をリセットする
   */
  resetStats() {
    this.translationStats = {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      cacheHits: 0,
      cacheMisses: 0,
      lastUpdated: new Date()
    };

    this.languageDetectionStats = {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      lastUpdated: new Date()
    };

    logger.info('パフォーマンス統計情報がリセットされました');
  }

  /**
   * 定期的な統計情報のログ出力を設定する
   */
  setupPeriodicLogging() {
    setInterval(() => {
      this.logStats();
    }, this.config.logInterval);
  }

  /**
   * 現在の統計情報をログに出力する
   */
  logStats() {
    const stats = this.getStats();
    logger.info('パフォーマンス統計', { stats });
  }

  /**
   * 指定したサービスの成功率を取得する
   * @param {string} serviceType - サービスタイプ ('translate' または 'detect')
   * @returns {number} 成功率（0～100）
   */
  getSuccessRate(serviceType) {
    if (serviceType === 'translate') {
      return this.getTranslationSuccessRate();
    } else if (serviceType === 'detect') {
      return this.getLanguageDetectionSuccessRate();
    } else {
      logger.warn(`未知のサービスタイプ: ${serviceType}`);
      return 0;
    }
  }

  /**
   * 指定したサービスの平均レスポンス時間を取得する
   * @param {string} serviceType - サービスタイプ ('translate' または 'detect')
   * @returns {number} 平均レスポンス時間（ミリ秒）
   */
  getAverageResponseTime(serviceType) {
    if (serviceType === 'translate') {
      return this.getAverageTranslationResponseTime();
    } else if (serviceType === 'detect') {
      return this.getAverageLanguageDetectionResponseTime();
    } else {
      logger.warn(`未知のサービスタイプ: ${serviceType}`);
      return 0;
    }
  }

  /**
   * 指定したキャッシュタイプのヒット率を取得する
   * @param {string} cacheType - キャッシュタイプ ('translation' または 'detection')
   * @returns {number} キャッシュヒット率（0～100）
   */
  getCacheHitRate(cacheType) {
    if (cacheType === 'translation') {
      const total = this.translationStats.cacheHits + this.translationStats.cacheMisses;
      if (total === 0) return 0;
      return (this.translationStats.cacheHits / total) * 100;
    } else if (cacheType === 'detection') {
      // 言語検出用のキャッシュの統計がない場合は0を返す
      return 0;
    } else {
      logger.warn(`未知のキャッシュタイプ: ${cacheType}`);
      return 0;
    }
  }

  /**
   * タイマー開始用メソッド
   * @returns {number} 現在のタイムスタンプ
   */
  startTimer() {
    return Date.now();
  }

  /**
   * タイマー終了用メソッド
   * @param {number} startTime - Timer開始時のタイムスタンプ
   * @returns {number} 経過ミリ秒
   */
  endTimer(startTime) {
    return Date.now() - startTime;
  }

  // API統計用のプロパティを追加
  apiStats = {
    translate: {
      totalCalls: 0,
      get successRate() {
        return this.parent.getTranslationSuccessRate();
      }
    },
    detect: {
      totalCalls: 0,
      get successRate() {
        return this.parent.getLanguageDetectionSuccessRate();
      }
    }
  };
}

// シングルトンインスタンスをエクスポート
export default new PerformanceMonitor(); 