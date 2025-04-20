/**
 * アプリケーション設定
 */
const config = {
  // 翻訳サービス設定
  translation: {
    apiKey: process.env.GOOGLE_API_KEY,
    apiUrl: 'https://translation.googleapis.com/language/translate/v2',
    defaultTargetLanguage: 'ja',
    supportedLanguages: ['en', 'ja', 'es', 'fr', 'de', 'zh', 'ko', 'ru', 'it', 'pt', 'ar', 'hi', 'th', 'vi'],
  },
  
  // 言語検出設定
  language: {
    cache: {
      maxSize: parseInt(process.env.LANGUAGE_CACHE_MAX_SIZE, 10) || 2000, // デフォルト2000
      ttl: parseInt(process.env.LANGUAGE_CACHE_TTL_DAYS, 10) * 24 * 60 * 60 * 1000 || 7 * 24 * 60 * 60 * 1000, // デフォルト7日(ミリ秒)
      confidenceThreshold: parseFloat(process.env.LANGUAGE_CACHE_CONFIDENCE_THRESHOLD) || 0.8, // デフォルト0.8
    },
  },

  // ストレージ設定
  storage: {
    dataDir: process.env.DATA_DIR || './data',
  },
  
  // ロギング設定
  logging: {
    logLevel: process.env.LOG_LEVEL || 'info',
    logDir: './logs',
  },
};

export default config; 