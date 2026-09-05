-- 既にdocuments/chunksにデータが入っている状態から、プロジェクト機能を追加する場合に実行するSQL。
-- 新規構築の場合はこのファイルは不要(schema.sqlだけで足ります)。

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- 既存の資料をまとめて入れておく「デフォルトプロジェクト」を作成
INSERT INTO projects (name) VALUES ('デフォルト') ON CONFLICT DO NOTHING;

-- documentsにproject_id列を追加し、既存データはデフォルトプロジェクトに割り当てる
ALTER TABLE documents ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;

UPDATE documents
SET project_id = (SELECT id FROM projects WHERE name = 'デフォルト' LIMIT 1)
WHERE project_id IS NULL;

ALTER TABLE documents ALTER COLUMN project_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS documents_project_id_idx ON documents (project_id);
