CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,        -- 'xlsx' / 'pptx'
  raw_text TEXT,                  -- 抽出した全文(要約用にそのまま保持)
  uploaded_at TIMESTAMP DEFAULT now()
);

CREATE TABLE chunks (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  source_label TEXT,              -- 例: "シート:集計" "スライド3"
  embedding VECTOR(1536)          -- OpenAI text-embedding-3-small の次元数
);

CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops);
