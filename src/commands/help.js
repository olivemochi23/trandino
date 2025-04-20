import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import logger from '../utils/logger.js';

/**
 * ヘルプコマンドの定義
 */
export const data = new SlashCommandBuilder()
  .setName('translate-help')
  .setDescription('翻訳ボットの使用方法を表示します');

/**
 * ヘルプコマンドの実行処理
 * @param {CommandInteraction} interaction - コマンドインタラクション
 */
export async function execute(interaction) {
  try {
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('翻訳ボットヘルプ')
      .setDescription('このボットは自動的に他言語のメッセージを日本語に翻訳します')
      .addFields(
        { name: '基本的な使い方', value: '設定されたチャンネルに投稿された日本語以外のメッセージを自動検知し、翻訳結果を表示します。' },
        { name: 'チャンネル設定', value: '`/translate-config channel` コマンドで翻訳対象のチャンネルを設定できます。' },
        { name: '設定の確認', value: '`/translate-config list` コマンドで現在の設定を確認できます。' },
        { name: '翻訳対象言語', value: '日本語以外のすべての言語が自動検出され、日本語に翻訳されます。' },
        { name: '注意事項', value: '短いメッセージや単語は言語判定の精度が下がる場合があります。' }
      )
      .setFooter({ text: 'Discord翻訳ボット v1.0.0' });

    await interaction.reply({ embeds: [embed] });
    logger.info('ヘルプコマンドが実行されました', { user: interaction.user.tag });
  } catch (error) {
    logger.error('ヘルプコマンド実行中にエラーが発生しました:', { error });
    await interaction.reply({ 
      content: 'コマンドの実行中にエラーが発生しました。時間をおいてからもう一度お試しください。',
      ephemeral: true
    });
  }
} 