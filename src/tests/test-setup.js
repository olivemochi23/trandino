/**
 * テスト環境のセットアップファイル
 * Jestを使用する際の共通設定を行います
 */

// 環境変数の設定
process.env.NODE_ENV = 'test';
process.env.DISCORD_TOKEN = 'test_token';
process.env.CLIENT_ID = 'test_client_id';
process.env.GUILD_ID = 'test_guild_id';
process.env.GOOGLE_PROJECT_ID = 'test_project_id';
process.env.GOOGLE_LOCATION = 'global';
process.env.LOG_LEVEL = 'error'; // テスト中はエラーのみログ出力

// Winstonロガーのモック化 -> 各テストファイルで必要に応じてモック化
// jest.mock('../utils/logger', () => ({
//   __esModule: true,
//   default: {
//     error: jest.fn(),
//     warn: jest.fn(),
//     info: jest.fn(),
//     debug: jest.fn(),
//   },
//   createLogger: jest.fn().mockImplementation(() => ({
//     error: jest.fn(),
//     warn: jest.fn(),
//     info: jest.fn(),
//     debug: jest.fn(),
//   })),
// }));

// モック化する標準ライブラリやフレームワーク
// - fs/promises はテストファイルごとに個別にモック化
// - discord.js は必要に応じてテストファイルごとに個別にモック化

// テスト実行前の共通処理 -> 各テストファイルで必要に応じて実装
// beforeAll(() => {
//   console.log('テストスイートを開始します');
// });

// 各テスト実行後の共通処理 -> 各テストファイルで必要に応じて実装
// afterEach(() => {
//   // 一部のモックをリセット
//   jest.clearAllMocks();
// });

// テスト実行後の共通処理 -> 各テストファイルで必要に応じて実装
// afterAll(() => {
//   console.log('テストスイートを終了します');
// }); 