import winston from 'winston';
import path from 'path';
import fs from 'fs/promises';

/**
 * ロガーを作成する
 * @param {Object} config - ロギング設定
 * @returns {winston.Logger} Winstonロガーインスタンス
 */
export function createLogger(config = {}) {
  const logDir = config.logDir || './logs';
  const logLevel = config.logLevel || process.env.LOG_LEVEL || 'info';
  
  // ログディレクトリの作成
  fs.mkdir(logDir, { recursive: true }).catch(err => {
    console.error('ログディレクトリの作成に失敗しました:', err);
  });
  
  const logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: 'translate-bot' },
    transports: [
      // エラーログはerror.logに記録
      new winston.transports.File({ 
        filename: path.join(logDir, 'error.log'), 
        level: 'error' 
      }),
      // 全ログはcombined.logに記録
      new winston.transports.File({ 
        filename: path.join(logDir, 'combined.log') 
      }),
    ],
  });
  
  // 開発環境では標準出力にもログを出力
  if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }));
  }
  
  return logger;
}

// デフォルトのロガーインスタンスをエクスポート
export default createLogger(); 