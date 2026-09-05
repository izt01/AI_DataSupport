# 資料チャットAI

xlsx・pptx・プログラムコード(html/css/js/py/java/c/c++/c#等)をアップロードし、プロジェクト単位でチャット形式のQ&A・要約・Excel/PowerPoint生成ができるアプリです。

## フォルダ構成

```
document-chat-ai/
├── backend/                     # Railwayにデプロイするサーバー本体
│   ├── server.js                # エントリーポイント
│   ├── db.js                    # PostgreSQL接続プール
│   ├── lib/
│   │   ├── extract.js           # xlsx/pptx/コードファイルからのテキスト抽出
│   │   ├── embed.js             # チャンク分割 + OpenAI埋め込み
│   │   ├── claude.js            # Anthropic Claude API呼び出し
│   │   └── context.js           # ベクトル検索(プロジェクト単位。チャット・生成で共有)
│   ├── routes/
│   │   ├── projects.js          # プロジェクトの作成/一覧/削除
│   │   ├── documents.js         # アップロード / 資料一覧 / 削除 / 要約生成
│   │   ├── chat.js              # チャットQ&A(コード引用にも対応)
│   │   └── generate.js          # Excel/PowerPoint生成
│   ├── sql/
│   │   ├── schema.sql           # DBスキーマ(pgvector, projects対応)
│   │   └── migrate_add_projects.sql  # 既存データにprojectsを追加する場合のマイグレーション
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
└── frontend/
    └── index.html               # GitHub Pagesで公開するフロントエンド一式
```

## プロジェクトについて

「システムA」「システムB」のように、資料とチャットをプロジェクト単位で分離できます。

- サイドバー上部の「+ 新規プロジェクト」からプロジェクトを作成
- プロジェクトを選択すると、そのプロジェクトの資料一覧・チャットに切り替わる
- アップロードした資料は、選択中のプロジェクトにのみ紐づく
- チャット・要約・Excel/PowerPoint生成も、選択中のプロジェクトの資料だけを対象に行われる
- プロジェクトを削除すると、中の資料もすべて削除される

## セットアップ手順

### 1. DB(Railway)

**新規構築の場合:**

1. Railwayで `pgvector/pgvector:pg16` のDockerイメージからPostgreSQLサービスを作成
2. 発行された接続情報で `backend/sql/schema.sql` を実行

```bash
psql "$DATABASE_URL" -f backend/sql/schema.sql
```

**既にdocuments/chunksにデータがある状態からプロジェクト機能を追加する場合:**

```bash
psql "$DATABASE_URL" -f backend/sql/migrate_add_projects.sql
```

これにより「デフォルト」という名前のプロジェクトが作られ、既存の資料はすべてそこに割り当てられます。

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

- Office: `.xlsx` `.pptx`
- プログラムコード: `.html` `.htm` `.css` `.scss` `.js` `.jsx` `.mjs` `.ts` `.tsx` `.py` `.java` `.c` `.h` `.cpp` `.cc` `.hpp` `.cs` `.rb` `.go` `.php` `.swift` `.kt` `.rs` `.sql` `.sh` `.json` `.yaml` `.yml` `.md` `.txt`

コードファイルは行番号ベースでチャンク分割されるため、チャットで「この処理のコードはどうなってる?」のように聞くと、該当箇所のコードをそのまま引用して回答します。

## 注意点

- Railwayのファイルシステムは再デプロイ時にリセットされるため、`generated/`(生成ファイル)や`uploads/`(一時アップロード)は永続化されません。生成したファイルはその都度ダウンロードしてください
- ベクトル埋め込みにはOpenAI Embeddings APIを使用しています(Anthropicは埋め込み専用モデルを提供していないため)
- プロジェクトを削除すると中の資料は復元できません
