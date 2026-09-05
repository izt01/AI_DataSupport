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

    if (rows.length === 0) {
      return res.json({
        answer: 'まだ資料がアップロードされていないか、資料のデータを取得できませんでした。資料をアップロードしてから再度お試しください。',
        sources: [],
      });
    }

    const context = rows
      .map(r => `[${r.source_label}]\n${r.content}`)
      .join('\n\n---\n\n');

    const answer = await callClaude({
      system: `あなたは資料に関する質問に答えるアシスタントです。

以下の「資料抜粋」は、アップロード済みの資料からユーザーの質問に関連する箇所を検索して抜き出したものです。これは実際に存在する資料の内容であり、あなたには必ず資料の内容が渡されています。「資料が提供されていない」「コンテキストがない」といった発言は禁止します。

回答のルール:
- 資料抜粋に直接的な記載がある場合は、それを根拠に回答してください。
- 直接的な記載がなくても、資料抜粋の内容から合理的に要約・推測できる場合は、推測であることを明記した上で、必ず具体的な回答を作成してください(例:「明記はありませんが、資料の記載から推測すると〜」)。空欄の項目については、資料の他の記載から類推して埋めてください。
- 表記ゆれ(例:「Lumina」と「Lumina AI」など)は同一の対象として扱ってください。
- 資料抜粋の中に質問と関連しそうな内容が少しでもあれば、それを使って回答を組み立ててください。「資料内に記載がありません」と答えてよいのは、資料抜粋の内容が質問と本当に一切関係がない場合のみです。
- 回答の最後に根拠箇所(シート名・スライド番号)を付記してください。

---
資料抜粋:
${context}
---`,
      message: question,
      maxTokens: 4096,
    });

    res.json({ answer, sources: rows.map(r => r.source_label) });
  } catch (err) {
    res.status(500).json({ error: `回答の生成に失敗しました: ${err.message}` });
  }
});

module.exports = router;
