const express = require('express');
const { retrieveContext } = require('../lib/context');
const { callClaude } = require('../lib/claude');

const router = express.Router();

router.post('/', async (req, res) => {
  const { documentId, question } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ error: '質問を入力してください' });
  }

  try {
    const rows = await retrieveContext(documentId, question, 5);
    const context = rows
      .map(r => `[${r.source_label}]\n${r.content}`)
      .join('\n\n---\n\n');

    const answer = await callClaude({
      system: `あなたは資料に関する質問に答えるアシスタントです。以下のコンテキストの範囲内で回答してください。コンテキストに答えがない場合は「資料内に記載がありません」と答えてください。回答の最後に根拠箇所(シート名・スライド番号)を付記してください。\n\n---\n${context}\n---`,
      message: question,
      maxTokens: 1024,
    });

    res.json({ answer, sources: rows.map(r => r.source_label) });
  } catch (err) {
    res.status(500).json({ error: `回答の生成に失敗しました: ${err.message}` });
  }
});

module.exports = router;
