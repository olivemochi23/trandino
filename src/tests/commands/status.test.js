import { jest, describe, beforeEach, test, expect } from '@jest/globals';

// performance-monitorをモック化
jest.mock('../../utils/performance-monitor.js', () => ({
  __esModule: true,
  default: {
    getSuccessRate: jest.fn().mockReturnValue(90),
    getAverageResponseTime: jest.fn().mockReturnValue(200),
    apiStats: { translate: { totalCalls: 10 }, detect: { totalCalls: 5 } },
    getCacheHitRate: jest.fn().mockReturnValue(75)
  }
}));

import { execute } from '../../commands/status.js';

describe('translate-status コマンド', () => {
  let interaction;
  let translationService;

  beforeEach(() => {
    interaction = { reply: jest.fn(), user: { tag: 'user#1' } };
    translationService = { isAvailable: jest.fn().mockReturnValue(true) };
  });

  test('正常動作時にステータス埋め込みを送信する', async () => {
    await execute(interaction, { translationService });
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const arg = interaction.reply.mock.calls[0][0];
    expect(arg.embeds).toHaveLength(1);
    const embed = arg.embeds[0];
    expect(embed.data.title).toBe('翻訳ボットステータス');
    const fields = embed.data.fields;
    expect(fields[0].name).toBe('翻訳API');
    expect(fields[1].name).toBe('言語検出API');
    expect(fields[2].name).toBe('キャッシュパフォーマンス');
    expect(fields[3].name).toBe('サービスステータス');
    expect(fields[3].value).toContain('✅ オンライン');
  });

  test('サービス利用不可時はオフライン表示になる', async () => {
    translationService.isAvailable.mockReturnValue(false);
    await execute(interaction, { translationService });
    const embed = interaction.reply.mock.calls[0][0].embeds[0];
    expect(embed.data.fields[3].value).toContain('❌ オフライン');
  });
}); 