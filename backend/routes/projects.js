const express = require('express');
const pool = require('../db');

const router = express.Router();

// ---------- プロジェクト一覧取得 ----------
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, created_at FROM projects ORDER BY created_at ASC`
    );
    res.json({ projects: rows });
  } catch (err) {
    res.status(500).json({ error: `プロジェクト一覧の取得に失敗しました: ${err.message}` });
  }
});

// ---------- プロジェクト作成 ----------
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'プロジェクト名を入力してください' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO projects (name) VALUES ($1) RETURNING id, name, created_at`,
      [name.trim()]
    );
    res.json({ project: rows[0] });
  } catch (err) {
    res.status(500).json({ error: `プロジェクトの作成に失敗しました: ${err.message}` });
  }
});

// ---------- プロジェクト削除(紐づく資料・チャンクもまとめて削除) ----------
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: `プロジェクトの削除に失敗しました: ${err.message}` });
  }
});

module.exports = router;
