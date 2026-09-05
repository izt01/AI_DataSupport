const pool = require('../db');
const { embedText } = require('./embed');

// documentIdを指定するとその資料内、省略すると全資料横断で類似チャンクを検索
async function retrieveContext(documentId, queryText, limit = 5) {
  const embedding = await embedText(queryText);
  const vectorParam = JSON.stringify(embedding);

  const params = documentId ? [documentId, vectorParam, limit] : [vectorParam, limit];
  const sql = documentId
    ? `SELECT content, source_label FROM chunks WHERE document_id = $1 ORDER BY embedding <=> $2 LIMIT $3`
    : `SELECT content, source_label FROM chunks ORDER BY embedding <=> $1 LIMIT $2`;

  const { rows } = await pool.query(sql, params);
  return rows;
}

module.exports = { retrieveContext };
