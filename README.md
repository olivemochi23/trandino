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

## ☁️ GCP (Cloud Run) へのデプロイ

このボットは Google Cloud Run にデプロイして運用することを推奨します。

### 前提条件

- 上記「セットアップ」の前提条件を満たしていること。
- GCPプロジェクトで課金が有効になっていること。
- Dockerイメージをプッシュするための Artifact Registry リポジトリが作成されていること (例: `asia-northeast1` リージョンに `trandino-repo` という名前で作成)。

### デプロイ手順

1.  **イメージのビルドとプッシュ:**
    プロジェクトルートで以下のコマンドを実行し、Dockerイメージをビルドして Artifact Registry にプッシュします (`PROJECT_ID`, `REGION`, `REPOSITORY_NAME` はご自身の環境に合わせてください)。
    ```powershell
    # 例: gcloud builds submit --tag asia-northeast1-docker.pkg.dev/translate-457307/trandino-repo/trandino-bot:latest --project=translate-457307
    gcloud builds submit --tag [REGION]-docker.pkg.dev/[PROJECT_ID]/[REPOSITORY_NAME]/trandino-bot:latest --project=[PROJECT_ID]
    ```

2.  **Cloud Run へのデプロイ:**
    ビルドしたイメージを Cloud Run にデプロイします。
    **重要:** Discordトークン (`DISCORD_TOKEN`) などの機密情報は、`--set-env-vars` で直接渡すのではなく、**必ず Secret Manager を使用して安全に管理してください**。以下のコマンドは `--set-env-vars` の例ですが、本番環境では `--set-secrets` を使用することを強く推奨します。

    ```powershell
    # --- Secret Managerを使用しない場合の例 (非推奨) ---
    # gcloud run deploy trandino-bot `
    #  --image [REGION]-docker.pkg.dev/[PROJECT_ID]/[REPOSITORY_NAME]/trandino-bot:latest `
    #  --platform managed `
    #  --region [REGION] `
    #  --no-allow-unauthenticated `
    #  --cpu-always-allocated `
    #  --set-env-vars=DISCORD_TOKEN="YOUR_DISCORD_TOKEN",CLIENT_ID="YOUR_CLIENT_ID",GUILD_ID="YOUR_GUILD_ID",GOOGLE_PROJECT_ID="[PROJECT_ID]",GOOGLE_LOCATION="global",NODE_ENV="production",LOG_LEVEL="info",DATA_DIR="/data" `
    #  --project=[PROJECT_ID]

    # --- Secret Managerを使用する場合の例 (推奨) ---
    # 事前に Secret Manager で DISCORD_TOKEN 等のシークレットを作成しておく必要があります。
    # 例: gcloud run deploy trandino-bot --image asia-northeast1-docker.pkg.dev/translate-457307/trandino-repo/trandino-bot:latest --platform managed --region asia-northeast1 --no-allow-unauthenticated --cpu-always-allocated --set-secrets=DISCORD_TOKEN=projects/[PROJECT_NUMBER]/secrets/DISCORD_TOKEN:latest --set-env-vars=CLIENT_ID="YOUR_CLIENT_ID",GUILD_ID="YOUR_GUILD_ID",GOOGLE_PROJECT_ID="[PROJECT_ID]",GOOGLE_LOCATION="global",NODE_ENV="production",LOG_LEVEL="info",DATA_DIR="/data" --project=[PROJECT_ID]
    gcloud run deploy trandino-bot `
     --image [REGION]-docker.pkg.dev/[PROJECT_ID]/[REPOSITORY_NAME]/trandino-bot:latest `
     --platform managed `
     --region [REGION] `
     --no-allow-unauthenticated `
     --cpu-always-allocated `
     --set-secrets=DISCORD_TOKEN=projects/[PROJECT_NUMBER]/secrets/YOUR_DISCORD_TOKEN_SECRET_NAME:latest ` # DiscordトークンをSecret Managerから読み込む
     --set-env-vars=CLIENT_ID="YOUR_CLIENT_ID",GUILD_ID="YOUR_GUILD_ID",GOOGLE_PROJECT_ID="[PROJECT_ID]",GOOGLE_LOCATION="global",NODE_ENV="production",LOG_LEVEL="info",DATA_DIR="/data" `
     --project=[PROJECT_ID]
    ```
    - `--no-allow-unauthenticated`: ボットは外部からのHTTPリクエストを直接受け付けないため設定。
    - `--cpu-always-allocated`: ボットを常時稼働させるために設定。
    - `DATA_DIR="/data"`: Cloud Run環境内のパスを指定していますが、Cloud Runはステートレスなため、このデータは永続化されません。永続化が必要な場合はCloud Storageなどの外部サービスを利用するように実装を変更する必要があります。

## 📖 コマンド

利用可能なスラッシュコマンドの一覧と詳細については、[コマンド一覧ドキュメント (docs/commands.md)](./docs/commands.md) を参照してください。

## 📜 ライセンス

このプロジェクトは [MIT License](./LICENSE) の下で公開されています。

## 📋 運用ガイド
運用時の各種手順やトラブルシュートは[運用ガイド](./docs/operation_guide.md)をご覧ください。 