const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const { extractSegments } = require('../lib/extract');
const { splitIntoChunks, embedText } = require('../lib/embed');
const { callClaude } = require('../lib/claude');

const router = express.Router();

// Railway等の実行環境差異を避けるため絶対パスで指定し、なければ自動作成する
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_DIR });

const MAX_SINGLE_PASS = 12000; // この文字数以下ならAI呼び出し1回で要約

// ---------- 資料一覧取得(ページ読み込み時に使用) ----------
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, filename, file_type FROM documents ORDER BY uploaded_at DESC`
    );
    res.json({ documents: rows });
  } catch (err) {
    res.status(500).json({ error: `資料一覧の取得に失敗しました: ${err.message}` });
  }
});

// ---------- 資料削除 ----------
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM documents WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: `削除に失敗しました: ${err.message}` });
  }
});

// ---------- アップロード + テキスト抽出 + チャンク化 + 埋め込み保存 ----------
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルが送信されていません' });
    }

    // multerはmultipartのファイル名をlatin1として解釈するため、
    // 日本語などのマルチバイト文字が文字化けする。utf8に変換し直す
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    const ext = originalName.split('.').pop().toLowerCase();
    if (!['xlsx', 'pptx'].includes(ext)) {
      return res.status(400).json({ error: '対応形式は .xlsx / .pptx のみです' });
    }

    const segments = await extractSegments(req.file.path, ext);
    const rawText = segments.map(s => `[${s.label}]\n${s.text}`).join('\n\n');

    const { rows } = await pool.query(
      `INSERT INTO documents (filename, file_type, raw_text) VALUES ($1, $2, $3) RETURNING id`,
      [originalName, ext, rawText]
    );
    const documentId = rows[0].id;

    await chunkAndEmbed(documentId, segments);

    res.json({ documentId });
  } catch (err) {
    res.status(500).json({ error: `アップロードに失敗しました: ${err.message}` });
  }
});

async function chunkAndEmbed(documentId, segments) {
  let globalIndex = 0;
  for (const segment of segments) {
    const subChunks = splitIntoChunks(segment.text);
    for (let i = 0; i < subChunks.length; i++) {
      const label = subChunks.length > 1
        ? `${segment.label}(${i + 1}/${subChunks.length})`
        : segment.label;

      const embedding = await embedText(subChunks[i]);

      await pool.query(
        `INSERT INTO chunks (document_id, chunk_index, content, source_label, embedding)
         VALUES ($1, $2, $3, $4, $5)`,
        [documentId, globalIndex++, subChunks[i], label, JSON.stringify(embedding)]
      );
    }
  }
}

// ---------- 要約生成 ----------
router.post('/:id/summary', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT raw_text, filename FROM documents WHERE id = $1',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '資料が見つかりません' });
    }

    const { raw_text, filename } = rows[0];
    if (!raw_text || !raw_text.trim()) {
      return res.status(400).json({ error: 'この資料にはテキストがありません' });
    }

    const summary = await summarizeText(raw_text, filename);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: `要約の生成に失敗しました: ${err.message}` });
  }
});

async function summarizeText(text, filename) {
  if (text.length <= MAX_SINGLE_PASS) {
    return await callClaude({
      system: `資料「${filename}」の内容を要約してください。要点を箇条書きにし、重要な数値・固有名詞は残してください。`,
      message: text,
    });
  }

  // 2段階要約: 分割して要約 → まとめて再要約
  const segments = splitIntoChunks(text, 6000, 200);
  const partials = [];
  for (const seg of segments) {
    const partial = await callClaude({
      system: `これは資料「${filename}」の一部分です。後で他の部分の要約と結合して最終的な要約を作るための中間要約を作成してください。重要な数値・固有名詞は省略せず残してください。`,
      message: seg,
    });
    partials.push(partial);
  }

  const combined = partials
    .map((s, i) => `【中間要約 ${i + 1}/${partials.length}】\n${s}`)
    .join('\n\n');

  return await callClaude({
    system: `以下は資料「${filename}」を分割して作成した中間要約です。これらをもとに、資料全体の要約を作成してください。重複している内容は整理し、要点を箇条書きでまとめてください。`,
    message: combined,
  });
}

module.exports = router;
