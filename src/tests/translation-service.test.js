import { TranslationService } from '../services/translation-service.js';
import { jest, describe, beforeEach, afterEach, afterAll, test, expect } from '@jest/globals';
import axios from 'axios'; // 直接インポートに変更

// performanceMonitor のモックは beforeEach 内の doMock で行うため削除
// jest.mock('../utils/performance-monitor.js', () => ({
//   __esModule: true,
//   default: {
//     startTimer: jest.fn(() => 12345),
//     endTimer: jest.fn(() => 100),
//     recordLanguageDetectionRequest: jest.fn(),
//     recordTranslationRequest: jest.fn(),
//   }
// }));

// axios をモック化
jest.mock('axios');

/**
 * TranslationService のテスト
 * axios をモックして API 呼び出しをシミュレートします。
 */

describe('TranslationService', () => {
  let service;
  let mockPerformanceMonitor; // モックの performanceMonitor

  beforeEach(() => {
    jest.resetAllMocks(); // clearAllMocks より強力

    // axios.get をモックするように修正
    axios.get = jest.fn().mockResolvedValue({ data: { data: { detections: [[{ language: 'en', confidence: 0.9 }]] } } });
    // axios.post も必要ならモック (translateText用)
    axios.post = jest.fn().mockResolvedValue({ data: { data: { translations: [{ translatedText: 'mock translation' }] } } });

    // performanceMonitor のモックを作成
    mockPerformanceMonitor = {
        startTimer: jest.fn(() => 12345),
        endTimer: jest.fn(() => 100),
        recordLanguageDetectionRequest: jest.fn(),
        recordTranslationRequest: jest.fn()
    };

    // ★ jest.doMock は削除
    // jest.doMock('../utils/performance-monitor.js', ...);

    // サービスの初期化
    service = new TranslationService({
      apiKey: 'test-api-key',
      apiUrl: 'https://mock-translation.googleapis.com/language/translate/v2',
      supportedLanguages: ['en', 'ja', 'es'],
      cache: { enabled: false },
      language: { cache: { enabled: false } }
    }, mockPerformanceMonitor); // モックを注入
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // テスト終了後に実行されるクリーンアップ
  afterAll(() => {
    jest.restoreAllMocks();
    // 非同期処理のすべてのモックをクリア
    if (axios.get?.mockRestore) {
      axios.get.mockRestore();
    }
    if (axios.post?.mockRestore) {
      axios.post.mockRestore();
    }
  });

  describe('detectLanguage', () => {
    test('正しく言語を検出すること', async () => {
      // axios.get のモック応答を設定
      axios.get.mockResolvedValueOnce({ data: { data: { detections: [[{ language: 'ja', confidence: 0.98 }]] } } });
      const result = await service.detectLanguage('こんにちは');
      expect(result.language).toBe('ja');
      expect(result.confidence).toBe(0.98);
      // axios.get が呼ばれたことを確認
      expect(axios.get).toHaveBeenCalledWith(
        'https://mock-translation.googleapis.com/language/translate/v2/detect',
        { params: { key: 'test-api-key', q: 'こんにちは' } }
      );
      // performanceMonitor のメソッドが呼ばれたか確認
      expect(mockPerformanceMonitor.startTimer).toHaveBeenCalled();
      expect(mockPerformanceMonitor.endTimer).toHaveBeenCalled();
      expect(mockPerformanceMonitor.recordLanguageDetectionRequest).toHaveBeenCalled();
    });

    test('空文字列の場合はエラーをスローすること', async () => {
      await expect(service.detectLanguage('')).rejects.toThrow('検出するテキストが指定されていません');
    });
  });

  describe('translateText', () => {
    test('正しくテキストを翻訳すること (言語検出あり)', async () => {
      // 言語検出のモック応答 (axios.get)
      axios.get.mockResolvedValueOnce({ data: { data: { detections: [[{ language: 'en', confidence: 0.95 }]] } } });
      // 翻訳のモック応答 (axios.post)
      axios.post.mockResolvedValueOnce({ data: { data: { translations: [{ translatedText: 'こんにちは' }] } } });

      const result = await service.translateText('Hello', 'ja');

      expect(result.translatedText).toBe('こんにちは');
      expect(result.sourceLanguage).toBe('en');
      expect(axios.get).toHaveBeenCalledTimes(1); // detect
      expect(axios.post).toHaveBeenCalledTimes(1); // translate
      // translate の呼び出し引数を検証 (axios.postは1回目なのでNth=1)
      expect(axios.post).toHaveBeenNthCalledWith(1,
        'https://mock-translation.googleapis.com/language/translate/v2',
        { q: 'Hello', source: 'en', target: 'ja', format: 'text' },
        { params: { key: 'test-api-key' } }
      );
      // performanceMonitor のメソッドが呼ばれたか確認
      expect(mockPerformanceMonitor.startTimer).toHaveBeenCalledTimes(2); // detectLanguage と translateText で呼ばれる
      expect(mockPerformanceMonitor.endTimer).toHaveBeenCalledTimes(2);
      expect(mockPerformanceMonitor.recordLanguageDetectionRequest).toHaveBeenCalled(); // detectLanguage 内
      expect(mockPerformanceMonitor.recordTranslationRequest).toHaveBeenCalled(); // translateText 内
    });

    test('翻訳元と翻訳先が同じ言語の場合は API を呼ばずに返すこと', async () => {
       // detectLanguage のモックをより詳細に設定
       axios.get.mockResolvedValueOnce({ data: { data: { detections: [[{ language: 'ja', confidence: 0.99 }]] } } });
       // detectLanguage が返す形式に合わせてモックを作成
       // jest.spyOn(service, 'detectLanguage').mockResolvedValue({ language: 'ja', confidence: 0.99, fromCache: false });

       const result = await service.translateText('こんにちは', 'ja');
       expect(result.translatedText).toBe('こんにちは');
       expect(result.sourceLanguage).toBe('ja');
       expect(axios.get).toHaveBeenCalledTimes(1); // detect のみ
       expect(axios.post).not.toHaveBeenCalled(); // translate は呼ばれない
    });

    test('空文字列の場合はエラーをスローすること', async () => {
      await expect(service.translateText('', 'ja')).rejects.toThrow('翻訳するテキストが指定されていません');
    });

     test('サポートされていない言語の場合はエラーをスローすること', async () => {
      await expect(service.translateText('Hello', 'xx')).rejects.toThrow('サポートされていない言語です: xx');
    });
  });

  describe('formatTranslationResult', () => {
    test('翻訳結果が正しく整形されること', () => {
      const originalText = 'Hello, world!';
      const translationResult = {
        translatedText: 'こんにちは、世界！',
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        confidence: 0.95,
        fromCache: false,
        languageFromCache: false
      };

      const result = service.formatTranslationResult(originalText, translationResult);

      expect(result.embeds[0].title).toContain('英語から日本語に翻訳');
      expect(result.embeds[0].description).toBe('こんにちは、世界！');
      expect(result.embeds[0].fields[0].name).toBe('元のテキスト');
      expect(result.embeds[0].fields[0].value).toBe(originalText);
      expect(result.embeds[0].footer.text).toContain('信頼度: 95.0%');
    });

    test('キャッシュ情報が含まれる場合にタイトルに表示されること', () => {
       const originalText = 'Some text';
      const translationResult = {
        translatedText: '翻訳されたテキスト',
        sourceLanguage: 'xyz',
        targetLanguage: 'ja',
        confidence: 0.7,
        fromCache: true,
        languageFromCache: true
      };
       const result = service.formatTranslationResult(originalText, translationResult);
       expect(result.embeds[0].title).toContain('[翻訳: キャッシュ, 言語検出: キャッシュ]');
    });
  });

  describe('_withRetry', () => {
    test('一度失敗してから成功するまでリトライすること', async () => {
      // 最初の呼び出しで500エラー、2回目で成功
      const error500 = { response: { status: 500 } };
      const mockFn = jest.fn()
        .mockRejectedValueOnce(error500)
        .mockResolvedValue('ok');
      const result = await service._withRetry(mockFn, 2, 0);
      expect(result).toBe('ok');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('リトライ回数を超えたらエラーをスローすること', async () => {
      // 常に503エラーを返す
      const error503 = { response: { status: 503 } };
      const mockFn = jest.fn().mockRejectedValue(error503);
      await expect(service._withRetry(mockFn, 2, 0)).rejects.toEqual(error503);
      // initial + リトライ2回
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    test('400エラーなどリトライ対象外のエラーは一度で止まること', async () => {
      // 400エラーはリトライしない
      const error400 = { response: { status: 400 } };
      const mockFn = jest.fn().mockRejectedValue(error400);
      await expect(service._withRetry(mockFn, 3, 0)).rejects.toEqual(error400);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
}); 