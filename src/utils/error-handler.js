import logger from './logger.js';
import { EmbedBuilder } from 'discord.js';

/**
 * エラー種別を判別する
 * @param {Error} error - エラーオブジェクト
 * @returns {Object} エラー情報（type: エラー種別, retryable: 再試行可能かどうか）
 */
export function categorizeError(error) {
  // Google Cloud APIのエラー
  if (error.code) {
    // レートリミット
    if (error.code === 429) {
      return { type: 'RATE_LIMIT', retryable: true };
    }
    // サーバーエラー
    if (error.code >= 500) {
      return { type: 'SERVER_ERROR', retryable: true };
    }
    // 認証エラー
    if (error.code === 401 || error.code === 403) {
      return { type: 'AUTH_ERROR', retryable: false };
    }
    // 無効なリクエスト
    if (error.code === 400) {
      return { type: 'INVALID_REQUEST', retryable: false };
    }
  }
  
  // Discord API関連のエラー
  if (error.httpStatus) {
    if (error.httpStatus === 429) {
      return { type: 'DISCORD_RATE_LIMIT', retryable: true };
    }
    if (error.httpStatus === 403) {
      return { type: 'DISCORD_PERMISSION', retryable: false };
    }
    if (error.httpStatus === 404) {
      return { type: 'DISCORD_NOT_FOUND', retryable: false };
    }
  }
  
  // ファイル操作関連のエラー
  if (error.code === 'ENOENT') {
    return { type: 'FILE_NOT_FOUND', retryable: false };
  }
  if (error.code === 'EACCES') {
    return { type: 'FILE_PERMISSION', retryable: false };
  }
  
  // その他のエラー
  return { type: 'UNKNOWN', retryable: false };
}

/**
 * ユーザー向けのエラーメッセージを取得
 * @param {Error} error - エラーオブジェクト
 * @returns {string} ユーザーフレンドリーなエラーメッセージ
 */
export function getUserFriendlyErrorMessage(error) {
  const errorInfo = categorizeError(error);
  
  switch (errorInfo.type) {
    case 'RATE_LIMIT':
    case 'DISCORD_RATE_LIMIT':
      return 'アクセス頻度の制限に達しました。しばらく待ってから再試行してください。';
    case 'SERVER_ERROR':
      return 'サーバーエラーが発生しました。時間をおいて再度お試しください。';
    case 'AUTH_ERROR':
      return '認証エラーが発生しました。ボット管理者にお問い合わせください。';
    case 'DISCORD_PERMISSION':
      return 'このアクションを実行する権限がありません。';
    case 'DISCORD_NOT_FOUND':
      return '対象が見つかりませんでした。削除された可能性があります。';
    case 'FILE_NOT_FOUND':
      return '必要なファイルが見つかりません。設定が初期化された可能性があります。';
    case 'FILE_PERMISSION':
      return 'ファイルへのアクセス権限がありません。ボット管理者にお問い合わせください。';
    case 'INVALID_REQUEST':
      return 'リクエストが無効です。入力内容を確認してください。';
    default:
      return 'エラーが発生しました。しばらくしてからもう一度お試しください。';
  }
}

/**
 * エラーをログに記録し、ユーザーフレンドリーなメッセージを返す
 * @param {Error} error - エラーオブジェクト
 * @param {Object} context - エラーに関する追加情報
 * @returns {Object} { message: ユーザー向けメッセージ, retryable: 再試行可能かどうか }
 */
export function handleError(error, context = {}) {
  const errorInfo = categorizeError(error);
  
  logger.error(`エラーが発生しました: ${errorInfo.type}`, {
    error: error.message,
    stack: error.stack,
    context,
    retryable: errorInfo.retryable
  });
  
  return {
    message: getUserFriendlyErrorMessage(error),
    retryable: errorInfo.retryable
  };
}

/**
 * 特定のエラー種別かどうかを判定
 * @param {Error} error - エラーオブジェクト
 * @param {string} type - 確認するエラー種別
 * @returns {boolean} 指定したエラー種別かどうか
 */
export function isErrorType(error, type) {
  const errorInfo = categorizeError(error);
  return errorInfo.type === type;
}

/**
 * 再試行可能なエラーかどうかを判定
 * @param {Error} error - エラーオブジェクト
 * @returns {boolean} 再試行可能かどうか
 */
export function isRetryableError(error) {
  const errorInfo = categorizeError(error);
  return errorInfo.retryable;
}

/**
 * エラーハンドラークラス
 * ボット全体でのエラー処理を一元管理します
 */
class ErrorHandler {
  /**
   * エラーの種類に基づいてユーザーフレンドリーなメッセージを返します
   * @param {Error} error - 発生したエラー
   * @param {string} context - エラーが発生したコンテキスト
   * @returns {string} ユーザーフレンドリーなエラーメッセージ
   */
  getUserFriendlyMessage(error, context = '') {
    // エラーの種類に基づいたメッセージを返す
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return '翻訳サービスへの接続中にエラーが発生しました。時間をおいてからもう一度お試しください。';
    } else if (error.code === 'RATELIMIT') {
      return '翻訳リクエストの制限に達しました。しばらく時間をおいてからもう一度お試しください。';
    } else if (error.name === 'DiscordAPIError') {
      return 'Discordとの通信中にエラーが発生しました。時間をおいてからもう一度お試しください。';
    } else if (error.message?.includes('language not supported')) {
      return 'サポートされていない言語が指定されました。/helpコマンドで対応言語リストを確認してください。';
    } else if (error.message?.includes('text too long')) {
      return 'テキストが長すぎます。短いメッセージに分割してお試しください。';
    }
    
    // デフォルトのエラーメッセージ
    return '予期せぬエラーが発生しました。時間をおいてからもう一度お試しください。';
  }

  /**
   * エラーを記録してユーザーに通知するEmbedを作成します
   * @param {Error} error - 発生したエラー
   * @param {string} context - エラーが発生したコンテキスト
   * @returns {EmbedBuilder} エラー通知用のEmbed
   */
  createErrorEmbed(error, context = '') {
    // エラーをログに記録
    logger.error(`${context}: ${error.message}`, { 
      error: error.stack, 
      errorCode: error.code,
      context 
    });
    
    // ユーザー向けのエラーメッセージを取得
    const userMessage = this.getUserFriendlyMessage(error, context);
    
    // エラー通知用のEmbedを作成
    return new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('エラーが発生しました')
      .setDescription(userMessage)
      .addFields({ 
        name: 'エラーID', 
        value: this.generateErrorId(),
        inline: true 
      })
      .setFooter({ text: '問題が続く場合は管理者にお問い合わせください' });
  }

  /**
   * 一意のエラーIDを生成します（トラブルシューティング用）
   * @returns {string} 一意のエラーID
   */
  generateErrorId() {
    return `ERR-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
  }

  /**
   * インタラクションでのエラー処理を行います
   * @param {Error} error - 発生したエラー
   * @param {CommandInteraction} interaction - コマンドインタラクション
   * @param {string} context - エラーが発生したコンテキスト
   */
  async handleInteractionError(error, interaction, context = 'コマンド実行') {
    try {
      const errorEmbed = this.createErrorEmbed(error, context);
      
      // インタラクションがすでに返信済みかどうかを確認
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ 
          embeds: [errorEmbed], 
          ephemeral: true 
        });
      } else {
        await interaction.reply({ 
          embeds: [errorEmbed], 
          ephemeral: true 
        });
      }
    } catch (followUpError) {
      // フォローアップエラーが発生した場合は単純にログに記録
      logger.error(`インタラクションエラー通知中にエラーが発生: ${followUpError.message}`, {
        originalError: error.message,
        followUpError: followUpError.stack
      });
    }
  }
}

// シングルトンインスタンスをエクスポート
export default new ErrorHandler(); 