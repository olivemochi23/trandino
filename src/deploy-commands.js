import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Moduleでの __dirname相当の対応
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 環境変数の確認
const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('環境変数が設定されていません。.envファイルを確認してください。');
  process.exit(1);
}

async function main() {
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    try {
      // ESMでのモジュールロード
      const filePath = path.join(commandsPath, file);
      // ファイルURLへ変換（Windowsでの互換性対応）
      const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
      const command = await import(fileUrl);
      
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`コマンドを読み込みました: ${command.data.name}`);
      } else {
        console.warn(`[警告] ${file} にはdata/executeプロパティがありません`);
      }
    } catch (error) {
      console.error(`[エラー] ${file}の読み込み中にエラーが発生しました:`, error);
    }
  }
  
  // RESTモジュールの初期化
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  
  try {
    console.log(`${commands.length}個のスラッシュコマンドを登録しています...`);
    
    let data;
    
    if (GUILD_ID) {
      // 特定のサーバーに登録（開発用）
      data = await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
      );
      console.log(`${GUILD_ID}のサーバーに${data.length}個のコマンドを登録しました`);
    } else {
      // グローバルに登録（本番用）
      data = await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );
      console.log(`グローバルに${data.length}個のコマンドを登録しました`);
    }
  } catch (error) {
    console.error('コマンド登録中にエラーが発生しました:', error);
  }
}

main().catch(error => {
  console.error('スクリプト実行中にエラーが発生しました:', error);
}); 