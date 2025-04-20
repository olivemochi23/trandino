import { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import logger from '../utils/logger.js';

/**
 * 設定コマンドの定義
 */
export const data = new SlashCommandBuilder()
  .setName('translate-config')
  .setDescription('翻訳ボットの設定を変更します')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(subcommand =>
    subcommand
      .setName('channel')
      .setDescription('翻訳対象チャンネルを設定します')
      .addChannelOption(option => 
        option.setName('channel')
          .setDescription('翻訳を有効にするチャンネル')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true))
      .addBooleanOption(option =>
        option.setName('enabled')
          .setDescription('有効にするか無効にするか')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('現在の設定を表示します'));

/**
 * 設定コマンドの実行処理
 * @param {CommandInteraction} interaction - コマンドインタラクション
 * @param {ChannelManager} channelManager - チャンネル管理クラスのインスタンス
 */
export async function execute(interaction, { channelManager }) {
  try {
    // 権限のチェック
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: '設定を変更するには「サーバーの管理」権限が必要です。',
        ephemeral: true
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'channel') {
      await handleChannelConfig(interaction, channelManager);
    } else if (subcommand === 'list') {
      await handleListConfig(interaction, channelManager);
    }
  } catch (error) {
    logger.error('設定コマンド実行中にエラーが発生しました:', { error });
    await interaction.reply({ 
      content: 'コマンドの実行中にエラーが発生しました。時間をおいてからもう一度お試しください。',
      ephemeral: true 
    });
  }
}

/**
 * チャンネル設定コマンドの処理
 * @param {CommandInteraction} interaction - コマンドインタラクション
 * @param {ChannelManager} channelManager - チャンネル管理クラスのインスタンス
 */
async function handleChannelConfig(interaction, channelManager) {
  // インタラクションが遅延するかもしれないことを通知
  await interaction.deferReply();
  
  const channel = interaction.options.getChannel('channel');
  const enabled = interaction.options.getBoolean('enabled');
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  
  try {
    if (enabled) {
      // チャンネルを追加
      await channelManager.addChannel(guildId, channel.id, userId);
      
      await interaction.editReply({
        content: `✅ チャンネル ${channel} を翻訳対象に追加しました。`
      });
      
      logger.info('翻訳チャンネルが追加されました', { 
        guild: interaction.guild.name,
        channel: channel.name,
        user: interaction.user.tag
      });
    } else {
      // チャンネルを削除
      await channelManager.removeChannel(guildId, channel.id, userId);
      
      await interaction.editReply({
        content: `✅ チャンネル ${channel} を翻訳対象から削除しました。`
      });
      
      logger.info('翻訳チャンネルが削除されました', { 
        guild: interaction.guild.name,
        channel: channel.name,
        user: interaction.user.tag
      });
    }
  } catch (error) {
    logger.error('チャンネル設定中にエラーが発生しました:', { error });
    await interaction.editReply({
      content: '設定の変更中にエラーが発生しました。時間をおいてからもう一度お試しください。'
    });
  }
}

/**
 * 設定一覧表示コマンドの処理
 * @param {CommandInteraction} interaction - コマンドインタラクション
 * @param {ChannelManager} channelManager - チャンネル管理クラスのインスタンス
 */
async function handleListConfig(interaction, channelManager) {
  // インタラクションが遅延するかもしれないことを通知
  await interaction.deferReply();
  
  const guildId = interaction.guildId;
  
  try {
    const enabledChannels = await channelManager.getEnabledChannels(guildId);
    
    if (enabledChannels.length === 0) {
      await interaction.editReply({
        content: '翻訳対象に設定されているチャンネルはありません。`/translate-config channel` コマンドで設定してください。'
      });
      return;
    }
    
    // チャンネル情報を取得
    const channelList = enabledChannels.map(channelId => {
      const channel = interaction.guild.channels.cache.get(channelId);
      return channel ? `<#${channelId}>` : `[削除済み: ${channelId}]`;
    });
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('翻訳ボット設定')
      .addFields(
        { name: '翻訳対象チャンネル', value: channelList.join('\n') || '設定されていません' },
      )
      .setFooter({ text: '設定変更には /translate-config channel を使用してください' });
      
    await interaction.editReply({ embeds: [embed] });
    logger.debug('設定一覧が表示されました', { guild: interaction.guild.name, user: interaction.user.tag });
  } catch (error) {
    logger.error('設定一覧表示中にエラーが発生しました:', { error });
    await interaction.editReply({
      content: '設定の取得中にエラーが発生しました。時間をおいてからもう一度お試しください。'
    });
  }
} 