// tests/translation-service.test.js
import { jest, describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals'; // Import Jest globals
import axios from 'axios'; // 直接インポートに変更
import { TranslationService } from '../src/services/translation-service.js'; // 直接インポート

// axios をモック化
jest.mock('axios');

// performanceMonitor のモックは beforeEach 内の doMock で行うため削除
// jest.mock('../src/utils/performance-monitor.js', () => ({
//   __esModule: true,
//   default: {
//     startTimer: jest.fn(() => 12345),
//     endTimer: jest.fn(() => 100),
//     recordLanguageDetectionRequest: jest.fn(),
//     recordTranslationRequest: jest.fn(),
//   }
// }));

// @google-cloud/translate のモックは不要な可能性が高いためコメントアウト
// jest.mock('@google-cloud/translate/build/src/v2/index.js', () => {
//   return {
//     Translate: jest.fn().mockImplementation(() => {
//       return {
//         translate: jest.fn().mockResolvedValue(['Translated text from mock']),
//         detect: jest.fn().mockResolvedValue([{ language: 'en', confidence: 1 }]),
//       };
//     }),
//   };
// });

describe('Translation Service (Root Test)', () => {
  let translationService;
  let mockPerformanceMonitor; // モックの performanceMonitor

  beforeEach(() => {
    jest.resetAllMocks(); // clearAllMocks より強力

    // axios モック設定
    axios.post = jest.fn().mockResolvedValue({ data: { data: { detections: [[{ language: 'en', confidence: 0.9 }]], translations: [{ translatedText: 'mock translation' }] } } });

    // performanceMonitor のモックを作成
    mockPerformanceMonitor = {
        startTimer: jest.fn(() => 12345),
        endTimer: jest.fn(() => 100),
        recordLanguageDetectionRequest: jest.fn(),
        recordTranslationRequest: jest.fn()
    };

    // ★ jest.doMock は削除
    // jest.doMock('../src/utils/performance-monitor.js', ...);

    const mockConfig = {
      apiKey: 'test-api-key',
      apiUrl: 'https://mock-translation.googleapis.com/language/translate/v2',
      supportedLanguages: ['en', 'ja', 'es'],
      cache: { enabled: false },
      language: { cache: { enabled: false } }
    };
    
    // サービスを初期化 (動的インポートを避ける)
    translationService = new TranslationService(mockConfig, mockPerformanceMonitor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // テスト終了後に実行されるクリーンアップ
  afterAll(() => {
    jest.restoreAllMocks();
    // 非同期処理のすべてのモックをクリア
    if (axios.post.mockRestore) {
      axios.post.mockRestore();
    }
  });

  it('should translate text correctly using mocked axios', async () => {
    const text = 'Hello';
    const targetLanguage = 'ja';
    const expectedTranslation = 'mock translation from test'; // テスト固有の応答

    // 言語検出のモック応答を設定
    axios.post.mockResolvedValueOnce({ data: { data: { detections: [[{ language: 'en', confidence: 0.95 }]] } } });
    // 翻訳のモック応答を設定
    axios.post.mockResolvedValueOnce({ data: { data: { translations: [{ translatedText: expectedTranslation }] } } });

    const result = await translationService.translateText(text, targetLanguage);

    expect(result.translatedText).toBe(expectedTranslation);
    expect(axios.post).toHaveBeenCalledTimes(2);
    // 2回目の呼び出し (translate) の引数を検証
    expect(axios.post).toHaveBeenNthCalledWith(2,
      'https://mock-translation.googleapis.com/language/translate/v2',
      { q: text, source: 'en', target: targetLanguage, format: 'text' },
      { params: { key: 'test-api-key' } }
    );
    // performanceMonitor のメソッドが呼ばれたか確認
    expect(mockPerformanceMonitor.startTimer).toHaveBeenCalledTimes(2);
    expect(mockPerformanceMonitor.endTimer).toHaveBeenCalledTimes(2);
    expect(mockPerformanceMonitor.recordLanguageDetectionRequest).toHaveBeenCalled();
    expect(mockPerformanceMonitor.recordTranslationRequest).toHaveBeenCalled();
  });

  // 他のテストケースも同様に修正が必要
}); 