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
    // 検索範囲を広め(表紙など1シートだけに偏らないよう)に取得
    const rows = await retrieveContext(documentId, question, 12);
    const context = rows
      .map(r => `[${r.source_label}]\n${r.content}`)
      .join('\n\n---\n\n');

    const answer = await callClaude({
      system: `あなたは資料に関する質問に答えるアシスタントです。以下のコンテキストをもとに回答してください。

- コンテキストに直接的な記載がある場合は、それを根拠に回答してください。
- 直接的な記載がなくても、コンテキストの内容から合理的に要約・推測できる場合は、推測であることを明記した上で回答してください(例:「明記はありませんが、資料の記載から推測すると〜」)。
- 表記ゆれ(例:「Lumina」と「Lumina AI」など)は同一の対象として扱ってください。
- 本当に関連する情報がコンテキスト内に一切ない場合のみ、「資料内に記載がありません」と答えてください。
- 回答の最後に根拠箇所(シート名・スライド番号)を付記してください。

---
${context}
---`,
      message: question,
      maxTokens: 1024,
    });

    res.json({ answer, sources: rows.map(r => r.source_label) });
  } catch (err) {
    res.status(500).json({ error: `回答の生成に失敗しました: ${err.message}` });
  }
});

module.exports = router;
