const pool = require('../db');
const { embedText } = require('./embed');

// projectId(必須)でプロジェクト内に絞り込み、documentIdも指定するとさらにその資料内だけに絞り込む
async function retrieveContext(projectId, documentId, queryText, limit = 5) {
  const embedding = await embedText(queryText);
  const vectorParam = JSON.stringify(embedding);

  let sql;
  let params;
  if (documentId) {
    sql = `
      SELECT c.content, c.source_label
      FROM chunks c
      JOIN documents d ON d.id = c.document_id
      WHERE d.project_id = $1 AND c.document_id = $2
      ORDER BY c.embedding <=> $3
      LIMIT $4
    `;
    params = [projectId, documentId, vectorParam, limit];
  } else {
    sql = `
      SELECT c.content, c.source_label
      FROM chunks c
      JOIN documents d ON d.id = c.document_id
      WHERE d.project_id = $1
      ORDER BY c.embedding <=> $2
      LIMIT $3
    `;
    params = [projectId, vectorParam, limit];
  }

  const { rows } = await pool.query(sql, params);
  return rows;
}

module.exports = { retrieveContext };
