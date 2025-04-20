import { execute } from '../../commands/config.js';
import { jest, describe, beforeEach, test, expect } from '@jest/globals';

// モックのInteractionとChannelManagerを用意してexecute関数をテスト

describe('translate-config コマンド', () => {
  let interaction;
  let channelManager;

  beforeEach(() => {
    // Interactionのモック
    interaction = {
      deferReply: jest.fn(),
      editReply: jest.fn(),
      reply: jest.fn(),
      options: {
        getSubcommand: jest.fn(),
        getChannel: jest.fn(),
        getBoolean: jest.fn(),
      },
      memberPermissions: { has: jest.fn().mockReturnValue(true) },
      guildId: 'guild1',
      user: { id: 'user1', tag: 'user#1' },
      guild: {
        name: 'TestGuild',
        channels: {
          cache: new Map([
            ['chan1', { id: 'chan1', name: 'channel1', toString: () => '<#chan1>' }]
          ])
        }
      }
    };
    // ChannelManagerのモック
    channelManager = {
      addChannel: jest.fn(),
      removeChannel: jest.fn(),
      getEnabledChannels: jest.fn()
    };
  });

  test('権限がない場合はエラーメッセージを返す', async () => {
    interaction.memberPermissions.has.mockReturnValue(false);
    interaction.options.getSubcommand.mockReturnValue('channel');

    await execute(interaction, { channelManager });
    expect(interaction.reply).toHaveBeenCalledWith({
      content: '設定を変更するには「サーバーの管理」権限が必要です。',
      ephemeral: true
    });
  });

  test('channelサブコマンドで有効化するとaddChannelが呼ばれる', async () => {
    interaction.options.getSubcommand.mockReturnValue('channel');
    interaction.options.getChannel.mockReturnValue({ id: 'chan1', toString: () => '<#chan1>' });
    interaction.options.getBoolean.mockReturnValue(true);

    await execute(interaction, { channelManager });
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(channelManager.addChannel).toHaveBeenCalledWith('guild1', 'chan1', 'user1');
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: '✅ チャンネル <#chan1> を翻訳対象に追加しました。'
    });
  });

  test('channelサブコマンドで無効化するとremoveChannelが呼ばれる', async () => {
    interaction.options.getSubcommand.mockReturnValue('channel');
    interaction.options.getChannel.mockReturnValue({ id: 'chan1', toString: () => '<#chan1>' });
    interaction.options.getBoolean.mockReturnValue(false);

    await execute(interaction, { channelManager });
    expect(channelManager.removeChannel).toHaveBeenCalledWith('guild1', 'chan1', 'user1');
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: '✅ チャンネル <#chan1> を翻訳対象から削除しました。'
    });
  });

  test('listサブコマンドで未設定の場合は案内メッセージを返す', async () => {
    interaction.options.getSubcommand.mockReturnValue('list');
    channelManager.getEnabledChannels.mockResolvedValue([]);

    await execute(interaction, { channelManager });
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: '翻訳対象に設定されているチャンネルはありません。`/translate-config channel` コマンドで設定してください。'
    });
  });

  test('listサブコマンドで設定済みチャンネルがある場合はembedで返す', async () => {
    interaction.options.getSubcommand.mockReturnValue('list');
    channelManager.getEnabledChannels.mockResolvedValue(['chan1']);

    await execute(interaction, { channelManager });
    expect(interaction.deferReply).toHaveBeenCalled();
    const callArg = interaction.editReply.mock.calls[0][0];
    expect(callArg.embeds).toHaveLength(1);
    const embed = callArg.embeds[0];
    // EmbedBuilder の内部データを確認
    expect(embed.data.title).toBe('翻訳ボット設定');
    expect(embed.data.fields[0].name).toBe('翻訳対象チャンネル');
    expect(embed.data.fields[0].value).toBe('<#chan1>');
  });
}); 