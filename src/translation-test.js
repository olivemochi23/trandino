import 'dotenv/config';
import { TranslationServiceClient } from '@google-cloud/translate';

async function testTranslation() {
  try {
    // Translation APIクライアントの初期化 - ADCを自動的に使用
    const translationClient = new TranslationServiceClient();
    const projectId = process.env.GOOGLE_PROJECT_ID;
    const location = process.env.GOOGLE_LOCATION || 'global';
    
    // テスト用のテキスト
    const text = 'Hello, world!';
    
    // リクエスト設定
    const request = {
      parent: `projects/${projectId}/locations/${location}`,
      contents: [text],
      mimeType: 'text/plain',
      sourceLanguageCode: 'en',
      targetLanguageCode: 'ja',
    };
    
    // 翻訳実行
    console.log(`Translating text: "${text}"`);
    const [response] = await translationClient.translateText(request);
    console.log(`Translation result: "${response.translations[0].translatedText}"`);
    
    // 言語検出テスト
    const detectRequest = {
      parent: `projects/${projectId}/locations/${location}`,
      content: text,
      mimeType: 'text/plain',
    };
    
    console.log(`Detecting language for: "${text}"`);
    const [detectResponse] = await translationClient.detectLanguage(detectRequest);
    console.log('Language detection result:', detectResponse.languages);
    
    console.log('Translation API test completed successfully!');
  } catch (error) {
    console.error('Translation API test failed:', error);
  }
}

testTranslation(); 