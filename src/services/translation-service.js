import axios from 'axios';
import logger from '../utils/logger.js';
import { TranslationCache } from '../utils/translation-cache.js';
import { LanguageCache } from '../utils/language-cache.js';

/**
 * 翻訳サービスクラス
 * 翻訳機能を提供するサービス
 */
export class TranslationService {
  constructor(config, performanceMonitorInstance) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl || 'https://translation.googleapis.com/language/translate/v2';
    this.defaultTargetLanguage = config.defaultTargetLanguage || 'ja';
    this.supportedLanguages = config.supportedLanguages || ['en', 'ja', 'es', 'fr', 'de', 'zh', 'ko', 'ru'];
    
    this.performanceMonitor = performanceMonitorInstance || {
        startTimer: () => Date.now(),
        endTimer: () => 0,
        recordLanguageDetectionRequest: () => {},
        recordTranslationRequest: () => {}
    };
    
    // キャッシュのインスタンス化
    this.translationCache = new TranslationCache(config.cache);
    this.languageCache = new LanguageCache(config.language?.cache);
    
    logger.info('翻訳サービスを初期化しました');
  }
  
  /**
   * テキストの言語を検出する
   * @param {string} text - 検出するテキスト
   * @returns {Promise<Object>} 検出された言語情報 { language: string, confidence: number }
   */
  async detectLanguage(text) {
    if (!text || text.trim().length === 0) {
      throw new Error('検出するテキストが指定されていません');
    }
    
    // パフォーマンスモニタリング開始
    const startTime = this.performanceMonitor.startTimer();
    
    try {
      // キャッシュから言語を取得
      const cachedResult = this.languageCache.get(text);
      if (cachedResult) {
        logger.debug(`言語検出キャッシュヒット: ${text.substring(0, 30)}... => ${cachedResult.language}`);
        this.performanceMonitor.recordLanguageDetectionRequest(true, 0, true);
        return cachedResult;
      }
      
      // キャッシュになければAPIを呼び出し
      const response = await axios.post(`${this.apiUrl}/detect`, {
        q: text
      }, {
        params: {
          key: this.apiKey
        }
      });
      
      const detectionResult = response.data.data.detections[0][0];
      const detectedLanguage = detectionResult.language;
      const confidence = detectionResult.confidence;
      
      // 結果オブジェクトを作成
      const result = {
        language: detectedLanguage,
        confidence: confidence
      };
      
      // パフォーマンスモニタリング終了
      const duration = this.performanceMonitor.endTimer(startTime);
      this.performanceMonitor.recordLanguageDetectionRequest(false, duration, false);
      
      // 結果をキャッシュに保存（キャッシュ側で信頼度のチェックを行う）
      this.languageCache.set(text, result);
      
      logger.debug(`言語検出API結果: ${text.substring(0, 30)}... => ${detectedLanguage} (信頼度: ${confidence.toFixed(2)})`);
      return result;
    } catch (error) {
      logger.error(`言語検出に失敗しました: ${error.message}`);
      throw new Error(`言語検出に失敗しました: ${error.message}`);
    }
  }
  
  /**
   * テキストを翻訳する
   * @param {string} text - 翻訳するテキスト
   * @param {string} targetLanguage - 翻訳先言語
   * @param {string} sourceLanguage - 翻訳元言語（自動検出する場合はnull）
   * @returns {Promise<Object>} 翻訳結果
   */
  async translateText(text, targetLanguage = this.defaultTargetLanguage, sourceLanguage = null) {
    if (!text || text.trim().length === 0) {
      throw new Error('翻訳するテキストが指定されていません');
    }
    
    if (!this.supportedLanguages.includes(targetLanguage)) {
      throw new Error(`サポートされていない言語です: ${targetLanguage}`);
    }
    
    // パフォーマンスモニタリング開始
    const startTime = this.performanceMonitor.startTimer();
    
    try {
      // 翻訳元言語が指定されていない場合は自動検出
      let detectedSourceLanguage = sourceLanguage;
      let languageConfidence = null;
      let isLanguageFromCache = false;
      
      if (!sourceLanguage) {
        const languageDetection = await this.detectLanguage(text);
        detectedSourceLanguage = languageDetection.language;
        languageConfidence = languageDetection.confidence;
        isLanguageFromCache = languageDetection.fromCache || false;
        
        // 翻訳先と同じ言語の場合は翻訳不要
        if (detectedSourceLanguage === targetLanguage) {
          return {
            translatedText: text,
            sourceLanguage: detectedSourceLanguage,
            targetLanguage,
            confidence: languageConfidence,
            fromCache: false,
            languageFromCache: isLanguageFromCache
          };
        }
      }
      
      // キャッシュから翻訳結果を取得
      const cachedTranslation = this.translationCache.get(text, detectedSourceLanguage, targetLanguage);
      if (cachedTranslation) {
        this.performanceMonitor.recordTranslationRequest(true, 0, true);
        return {
          translatedText: cachedTranslation,
          sourceLanguage: detectedSourceLanguage,
          targetLanguage,
          confidence: languageConfidence,
          fromCache: true,
          languageFromCache: isLanguageFromCache
        };
      }
      
      // キャッシュになければAPIを呼び出し
      const response = await axios.post(`${this.apiUrl}`, {
        q: text,
        source: detectedSourceLanguage,
        target: targetLanguage,
        format: 'text'
      }, {
        params: {
          key: this.apiKey
        }
      });
      
      const translatedText = response.data.data.translations[0].translatedText;
      
      // パフォーマンスモニタリング終了
      const duration = this.performanceMonitor.endTimer(startTime);
      this.performanceMonitor.recordTranslationRequest(false, duration, false);
      
      // 結果をキャッシュに保存
      this.translationCache.set(text, detectedSourceLanguage, targetLanguage, translatedText);
      
      return {
        translatedText,
        sourceLanguage: detectedSourceLanguage,
        targetLanguage,
        confidence: languageConfidence,
        fromCache: false,
        languageFromCache: isLanguageFromCache
      };
    } catch (error) {
      logger.error(`翻訳に失敗しました: ${error.message}`);
      throw new Error(`翻訳に失敗しました: ${error.message}`);
    }
  }
  
  /**
   * 翻訳結果をDiscordメッセージとして整形する
   * @param {string} originalText - 元のテキスト
   * @param {Object} translationResult - 翻訳結果オブジェクト
   * @returns {Object} Discordへ送信するメッセージオブジェクト
   */
  formatTranslationResult(originalText, translationResult) {
    // 言語コードから表示用の言語名を取得
    const languageNames = {
      'en': '英語',
      'ja': '日本語',
      'ko': '韓国語',
      'zh': '中国語',
      'zh-CN': '中国語（簡体字）',
      'zh-TW': '中国語（繁体字）',
      'fr': 'フランス語',
      'de': 'ドイツ語',
      'es': 'スペイン語',
      'ru': 'ロシア語',
      'it': 'イタリア語',
      'pt': 'ポルトガル語',
      'ar': 'アラビア語',
      'hi': 'ヒンディー語',
      'th': 'タイ語',
      'vi': 'ベトナム語'
    };
    
    const sourceLanguage = translationResult.sourceLanguage;
    const translatedText = translationResult.translatedText;
    const confidence = translationResult.confidence;
    const fromCache = translationResult.fromCache;
    const languageFromCache = translationResult.languageFromCache;
    
    // 信頼度に基づいて色を決定
    let color = 0x00FF00; // 緑: 高信頼度
    if (confidence < 0.8) color = 0xFFFF00; // 黄: 中信頼度
    if (confidence < 0.6) color = 0xFF9900; // オレンジ: 低信頼度
    
    // 言語名
    const languageName = languageNames[sourceLanguage] || sourceLanguage;
    
    // 信頼度情報のテキスト
    const confidenceText = confidence 
      ? `信頼度: ${(confidence * 100).toFixed(1)}%` 
      : '信頼度: 不明';
    
    // キャッシュ情報
    const cacheInfo = [];
    if (fromCache) cacheInfo.push('翻訳: キャッシュ');
    if (languageFromCache) cacheInfo.push('言語検出: キャッシュ');
    const cacheText = cacheInfo.length > 0 ? `[${cacheInfo.join(', ')}]` : '';
    
    // 埋め込みメッセージを作成
    return {
      embeds: [{
        color: color,
        title: `${languageName}から日本語に翻訳 ${cacheText}`,
        description: translatedText,
        fields: [
          {
            name: '元のテキスト',
            value: originalText.length > 1024 
              ? originalText.substring(0, 1021) + '...' 
              : originalText
          }
        ],
        footer: {
          text: confidenceText
        },
        timestamp: new Date()
      }]
    };
  }
  
  /**
   * 翻訳サービスの統計情報を取得する
   * @returns {Object} 統計情報
   */
  getStats() {
    return {
      translationCache: this.translationCache.getStats(),
      languageCache: this.languageCache.getStats()
    };
  }
  
  /**
   * キャッシュをクリアする
   */
  clearCaches() {
    this.translationCache.clear();
    this.languageCache.clear();
    logger.info('翻訳サービスのキャッシュをクリアしました');
  }
  
  /**
   * 翻訳サービスが利用可能かどうかを返す
   * @returns {boolean} サービスが利用可能な場合はtrue
   */
  isAvailable() {
    return true; // 常に利用可能とする
  }
} 