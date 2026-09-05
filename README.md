# 資料チャットAI

xlsx・pptx資料をアップロードし、チャット形式でQ&A・要約・Excel/PowerPoint生成ができるアプリです。

## フォルダ構成

```
document-chat-ai/
├── backend/                # Railwayにデプロイするサーバー本体
│   ├── server.js           # エントリーポイント
│   ├── db.js               # PostgreSQL接続プール
│   ├── lib/
│   │   ├── extract.js      # xlsx/pptxからのテキスト抽出
│   │   ├── embed.js        # チャンク分割 + OpenAI埋め込み
│   │   ├── claude.js       # Anthropic Claude API呼び出し
│   │   └── context.js      # ベクトル検索(チャット・生成で共有)
│   ├── routes/
│   │   ├── documents.js    # アップロード / 要約生成
│   │   ├── chat.js         # チャットQ&A
│   │   └── generate.js     # Excel/PowerPoint生成
│   ├── sql/
│   │   └── schema.sql      # DBスキーマ(pgvector)
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
└── frontend/
    └── index.html          # GitHub Pagesで公開するフロントエンド一式
```

## セットアップ手順

### 1. DB(Railway)

1. Railwayで `pgvector/pgvector:pg16` のDockerイメージからPostgreSQLサービスを作成
2. 発行された接続情報で `backend/sql/schema.sql` を実行

```bash
psql "$DATABASE_URL" -f backend/sql/schema.sql
```

### 2. バックエンド(Railway)

1. `backend/` をRailwayにデプロイ(GitHub連携でも、Railway CLIでも可)
2. 環境変数を設定(`.env.example` を参照): `DATABASE_URL` `OPENAI_API_KEY` `ANTHROPIC_API_KEY` `FRONTEND_ORIGIN`
3. デプロイ後、発行されるURL(例: `https://xxxx.up.railway.app`)を控えておく

ローカルで動作確認する場合:

```bash
cd backend
npm install
cp .env.example .env   # 値を編集
npm start
```

### 3. フロントエンド(GitHub Pages)

1. `frontend/index.html` 内の `API_BASE` を、Railwayで発行されたバックエンドのURLに書き換える
2. リポジトリの `main` ブランチ(またはGitHub Pages用ブランチ)に `frontend/` の中身、もしくは `index.html` をルートに置いてpush
3. リポジトリの Settings → Pages でGitHub Pagesを有効化

## 対応ファイル形式

`.xlsx` / `.pptx` のみ対応です。

## 注意点

- Railwayのファイルシステムは再デプロイ時にリセットされるため、`generated/`(生成ファイル)や`uploads/`(一時アップロード)は永続化されません。生成したファイルはその都度ダウンロードしてください
- ベクトル埋め込みにはOpenAI Embeddings APIを使用しています(Anthropicは埋め込み専用モデルを提供していないため)
