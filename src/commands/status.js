import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import logger from '../utils/logger.js';
import performanceMonitor from '../utils/performance-monitor.js';

/**
 * ステータスコマンドの定義
 */
export const data = new SlashCommandBuilder()
  .setName('translate-status')
  .setDescription('翻訳ボットの現在のステータスとパフォーマンス情報を表示します');

/**
 * ステータスコマンドの実行処理
 * @param {CommandInteraction} interaction - コマンドインタラクション
 * @param {Object} services - サービスオブジェクト
 */
export async function execute(interaction, { translationService }) {
  try {
    // 翻訳APIのステータス
    const translateSuccessRate = performanceMonitor.getSuccessRate('translate').toFixed(2);
    const translateAvgTime = performanceMonitor.getAverageResponseTime('translate').toFixed(2);
    const translateCalls = performanceMonitor.apiStats.translate.totalCalls;
    
    // 言語検出APIのステータス
    const detectSuccessRate = performanceMonitor.getSuccessRate('detect').toFixed(2);
    const detectAvgTime = performanceMonitor.getAverageResponseTime('detect').toFixed(2);
    const detectCalls = performanceMonitor.apiStats.detect.totalCalls;
    
    // キャッシュヒット率
    const detectionCacheHitRate = performanceMonitor.getCacheHitRate('detection').toFixed(2);
    const translationCacheHitRate = performanceMonitor.getCacheHitRate('translation').toFixed(2);
    
    // 通知ステータス色の決定（成功率によって色を変更）
    let statusColor = 0x00FF00; // デフォルトは緑
    if (translateSuccessRate < 90 || detectSuccessRate < 90) {
      statusColor = 0xFFFF00; // 黄色（警告）
    }
    if (translateSuccessRate < 75 || detectSuccessRate < 75) {
      statusColor = 0xFF0000; // 赤（危険）
    }
    
    // Embedの作成
    const embed = new EmbedBuilder()
      .setColor(statusColor)
      .setTitle('翻訳ボットステータス')
      .setDescription('現在のパフォーマンスと利用状況の統計情報')
      .addFields(
        { name: '翻訳API', value: 
          `成功率: ${translateSuccessRate}%\n` +
          `平均応答時間: ${translateAvgTime}ms\n` +
          `総リクエスト数: ${translateCalls}`, inline: true },
        { name: '言語検出API', value: 
          `成功率: ${detectSuccessRate}%\n` +
          `平均応答時間: ${detectAvgTime}ms\n` +
          `総リクエスト数: ${detectCalls}`, inline: true },
        { name: 'キャッシュパフォーマンス', value: 
          `言語検出キャッシュヒット率: ${detectionCacheHitRate}%\n` +
          `翻訳キャッシュヒット率: ${translationCacheHitRate}%` },
        { name: 'サービスステータス', value: 
          `翻訳サービス: ${translationService.isAvailable() ? '✅ オンライン' : '❌ オフライン'}` }
      )
      .setFooter({ text: `最終更新: ${new Date().toLocaleString('ja-JP')}` });

    await interaction.reply({ embeds: [embed] });
    logger.info('ステータスコマンドが実行されました', { user: interaction.user.tag });
  } catch (error) {
    logger.error('ステータスコマンド実行中にエラーが発生しました:', { error });
    await interaction.reply({ 
      content: 'コマンドの実行中にエラーが発生しました。時間をおいてからもう一度お試しください。',
      ephemeral: true 
    });
  }
} 