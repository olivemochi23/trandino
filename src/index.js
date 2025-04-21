import 'dotenv/config';
import { Bot } from './bot.js';
import logger from './utils/logger.js';
import http from 'http';

// アプリケーション設定の構築
const config = {
  // Discordボット設定
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  
  // 翻訳サービス設定
  translation: {
    apiKey: process.env.GOOGLE_API_KEY,
    apiUrl: process.env.GOOGLE_TRANSLATE_API_URL || 'https://translation.googleapis.com/language/translate/v2',
    defaultTargetLanguage: 'ja',
    supportedLanguages: ['en', 'ja', 'es', 'fr', 'de', 'zh', 'ko', 'ru', 'it', 'pt', 'ar', 'hi', 'th', 'vi'],
    cache: {
      maxSize: parseInt(process.env.TRANSLATION_CACHE_MAX_SIZE, 10) || 1000,
      ttl: (parseInt(process.env.TRANSLATION_CACHE_TTL_HOURS, 10) || 24) * 60 * 60 * 1000,
    },
    language: {
      cache: {
        maxSize: parseInt(process.env.LANGUAGE_CACHE_MAX_SIZE, 10) || 2000,
        ttl: (parseInt(process.env.LANGUAGE_CACHE_TTL_DAYS, 10) || 7) * 24 * 60 * 60 * 1000,
        confidenceThreshold: parseFloat(process.env.LANGUAGE_CACHE_CONFIDENCE_THRESHOLD) || 0.8,
      },
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

// 環境変数をログに出力（トークンは最初の数文字のみ）
logger.info(`環境変数: DISCORD_TOKEN=${config.token ? config.token.substring(0, 5) + '...' : 'undefined'}, CLIENT_ID=${process.env.CLIENT_ID || 'undefined'}, GUILD_ID=${process.env.GUILD_ID || 'undefined'}`);
logger.info(`環境変数: NODE_ENV=${process.env.NODE_ENV}, LOG_LEVEL=${process.env.LOG_LEVEL}, DATA_DIR=${process.env.DATA_DIR}`);
logger.info(`環境変数: GOOGLE_PROJECT_ID=${process.env.GOOGLE_PROJECT_ID}, GOOGLE_LOCATION=${process.env.GOOGLE_LOCATION}`);

// ボットの起動
async function startBot() {
  try {
    logger.info('翻訳ボットを起動しています...');
    
    // 環境変数チェック
    if (!config.token) {
      throw new Error('DISCORD_TOKENが設定されていません。.envファイルを確認してください。');
    }
    
    if (!config.translation.apiKey && !config.translation.projectId) {
      logger.warn('GOOGLE_API_KEY または GOOGLE_PROJECT_ID が設定されていません。翻訳機能が動作しない可能性があります。');
    }
    
    // ボットのインスタンス作成と起動
    const bot = new Bot(config);
    await bot.start();
    
    // 終了ハンドリング
    process.on('SIGINT', () => {
      logger.info('SIGINTシグナルを受信しました。ボットを停止します...');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      logger.info('SIGTERMシグナルを受信しました。ボットを停止します...');
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('ボットの起動に失敗しました:', error);
    process.exit(1);
  }
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  logger.error('未ハンドルのPromise拒否:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('未捕捉の例外:', error);
  process.exit(1);
});

// Cloud Run用ダミーHTTPサーバー（listen完了後にボット起動）
const port = parseInt(process.env.PORT || '8080', 10);
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Dummy server for Cloud Run health check\n');
});

// エラーハンドリングを強化
server.on('error', (err) => {
  logger.error(`HTTPサーバーエラー: ${err.message}`);
  // エラーの種類に応じて対応
  if (err.code === 'EADDRINUSE') {
    logger.error(`ポート ${port} は既に使用されています。`);
    // 別のポートを試す場合はここに実装
  }
});

server.listen(port, () => {
  logger.info(`Dummy HTTP server listening on port ${port}`);
  // listen完了後にボット起動
  startBot().catch(err => {
    logger.error('ボット起動中にエラーが発生しました:', err);
  });
});
