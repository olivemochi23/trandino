# TranDino - Discord翻訳ボット

[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![Discord.js Version](https://img.shields.io/badge/Discord.js-v14.18.0-blue)](https://discord.js.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

TranDinoは、Discordサーバー内のメッセージを自動的に検出し、指定された言語（デフォルトは日本語）に翻訳するボットです。

## ✨ 機能

- **自動言語検出:** メッセージの言語を自動的に検出します。
- **多言語翻訳:** Google Cloud Translation API を使用して、検出された言語から指定された言語へ翻訳します。
- **スラッシュコマンド:** 設定やステータス確認を簡単に行えるスラッシュコマンドを提供します。
- **チャンネル設定:** サーバー管理者は、特定のチャンネルを翻訳対象として設定できます。
- **キャッシュ機能:** 翻訳結果と言語検出結果をキャッシュし、APIの使用量を削減し、応答速度を向上させます。
- **パフォーマンスモニタリング:** APIの応答時間や成功率、キャッシュヒット率などの統計情報を確認できます。
- **ボタンやセレクトメニュー等で編集されたメッセージも自動翻訳対応**
    - メッセージが編集された場合（ボタン操作等含む）も、編集後の内容を自動で翻訳します。
- **翻訳結果のみを出力**
    - 翻訳時は「翻訳したテキストのみ」を埋め込みで表示し、元のテキストは表示しません。
- **Bot/アプリ/他のBotのメッセージも翻訳対象**
    - Webhookや他Botが送信したメッセージも翻訳対象になります（自分自身のメッセージは除外）。

## ⚙️ セットアップ

### 前提条件

- Node.js v20.0.0 以上
- npm (Node.jsに同梱)
- Git
- Discord Botアカウント ([Discord Developer Portal](https://discord.com/developers/applications) で作成)
- Google Cloud Platformアカウント
    - Cloud Translation API の有効化
    - Cloud Run API の有効化
    - Artifact Registry API の有効化
    - (推奨) Secret Manager API の有効化
- Google Cloud CLI (`gcloud`)
- Docker

### インストール

1.  リポジトリをクローンまたはダウンロードします。
    ```bash
    git clone <repository_url>
    cd <repository_directory>
    ```
2.  依存パッケージをインストールします。
    ```bash
    npm install
    ```

### 設定

1.  プロジェクトルートにある `.env.example` ファイルをコピーして `.env` という名前のファイルを作成します。
    ```bash
    cp .env.example .env
    ```
2.  `.env` ファイルを開き、以下の環境変数を設定します。
    - `DISCORD_TOKEN`: Discordボットのトークン (**重要:** Gitにコミットしないでください)
    - `CLIENT_ID`: DiscordボットのクライアントID
    - `GUILD_ID`: (開発時) テストサーバーのID
    - `GOOGLE_PROJECT_ID`: Google CloudプロジェクトID (APIキーの代わりにADCを使用する場合に推奨)
    - `GOOGLE_LOCATION`: (通常 `global`) Google Cloud Translation APIのロケーション
    - `NODE_ENV`: (通常 `development` または `production`)
    - `LOG_LEVEL`: (例: `info`, `debug`)
    - `DATA_DIR`: (例: `./data`)
    - **注意:** 以前のバージョンで使用していた `GOOGLE_API_KEY` や `GOOGLE_APPLICATION_CREDENTIALS` は、GCP環境 (Cloud Runなど) で実行する場合は通常不要です (Application Default Credentials (ADC) が自動的に使用されます)。ローカル開発でサービスアカウントキーファイルを使用する場合のみ `GOOGLE_APPLICATION_CREDENTIALS` を設定してください。

### スラッシュコマンドの登録

ボットを初めてサーバーに追加した際や、コマンドに変更があった場合は、以下のコマンドを実行してスラッシュコマンドをDiscordに登録する必要があります。

```bash
npm run deploy-commands
```

## 🚀 実行

### 通常起動

```bash
npm start
```

### 開発モード

コードの変更を監視し、自動的に再起動する開発モードで起動します。

```bash
npm run dev
```

## ☁️ GCP (Compute Engine + Docker) での運用（2025年4月最新ベストプラクティス）

### 前提条件
- Google Cloud プロジェクトが有効
- GCEのAPIが有効
- 外部IPありでVMを作成
- Dockerインストール済み

### デプロイ手順

1. **VMインスタンスの作成**
   ```powershell
   gcloud compute instances create trandino-bot-vm `
     --zone=asia-northeast1-a `
     --machine-type=e2-micro `
     --image-family=ubuntu-2204-lts `
     --image-project=ubuntu-os-cloud `
     --boot-disk-size=20GB `
     --tags=discord-bot `
     --scopes=https://www.googleapis.com/auth/cloud-platform
   ```

2. **SSHでVMに接続**
   - GCPコンソールの「VMインスタンス」→ `trandino-bot-vm` の「SSH」ボタン

3. **Dockerのインストール**
   ```bash
   sudo apt update
   sudo apt install -y docker.io
   sudo systemctl enable --now docker
   sudo usermod -aG docker $USER
   # 一度ログアウト・再ログインでdockerコマンドが使えるようになります
   ```

4. **プロジェクトの配置**
   ```bash
   git clone https://github.com/olivemochi23/trandino.git
   cd trandino
   ```

5. **.envファイルの作成**
   ```bash
   nano .env
   ```
   Cloud Runで使っていた環境変数を記載

6. **Dockerイメージのビルド**
   ```bash
   docker build -t trandino-bot .
   ```

7. **Dockerコンテナの起動**
   ```bash
   docker run --env-file .env --name trandino-bot -d --restart=always trandino-bot
   ```

8. **ログの確認**
   ```bash
   docker logs -f trandino-bot
   ```

---

## 📖 コマンド

利用可能なスラッシュコマンドの一覧と詳細については、[コマンド一覧ドキュメント (docs/commands.md)](./docs/commands.md) を参照してください。

## 📜 ライセンス

このプロジェクトは [MIT License](./LICENSE) の下で公開されています。

## 📋 運用ガイド
運用時の各種手順やトラブルシュートは[運用ガイド](./docs/operation_guide.md)をご覧ください。 