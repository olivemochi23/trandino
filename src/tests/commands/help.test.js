import { data, execute } from '../../commands/help.js';
import { jest, describe, beforeEach, test, expect } from '@jest/globals';

// translate-help コマンドのテスト

describe('translate-help コマンド', () => {
  let interaction;

  beforeEach(() => {
    interaction = {
      reply: jest.fn(),
      user: { tag: 'user#1' }
    };
  });

  test('コマンドデータの name と description が正しい', () => {
    expect(data.name).toBe('translate-help');
    expect(data.description).toBe('翻訳ボットの使用方法を表示します');
  });

  test('execute が埋め込みメッセージを送信する', async () => {
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const arg = interaction.reply.mock.calls[0][0];
    expect(arg.embeds).toHaveLength(1);
    const embed = arg.embeds[0];
    // タイトルと説明を検証
    expect(embed.data.title).toBe('翻訳ボットヘルプ');
    expect(embed.data.description).toContain('自動的に他言語のメッセージを日本語に翻訳');
    // フッターにバージョンが含まれる
    expect(embed.data.footer.text).toContain('v1.0.0');
  });
}); 