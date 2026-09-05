const express = require('express');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const pptxgen = require('pptxgenjs');
const { retrieveContext } = require('../lib/context');
const { callClaude } = require('../lib/claude');

const router = express.Router();
const GENERATED_DIR = path.join(__dirname, '..', 'generated');

router.post('/', async (req, res) => {
  const { documentId, format, instruction } = req.body;

  if (!['xlsx', 'pptx'].includes(format)) {
    return res.status(400).json({ error: '出力形式は xlsx または pptx を指定してください' });
  }
  if (!instruction || !instruction.trim()) {
    return res.status(400).json({ error: '生成したい内容を指示文で入力してください' });
  }

  try {
    const rows = await retrieveContext(documentId, instruction, 12);
    const context = rows
      .map(r => `[${r.source_label}]\n${r.content}`)
      .join('\n\n---\n\n');

    const structured = format === 'xlsx'
      ? await generateExcelStructure(instruction, context)
      : await generatePptxStructure(instruction, context);

    fs.mkdirSync(GENERATED_DIR, { recursive: true });
    const fileName = `${Date.now()}.${format}`;
    const filePath = path.join(GENERATED_DIR, fileName);

    if (format === 'xlsx') {
      await buildExcelFile(structured, filePath);
    } else {
      await buildPptxFile(structured, filePath);
    }

    res.json({ downloadUrl: `/generated/${fileName}`, fileName });
  } catch (err) {
    res.status(500).json({ error: `生成に失敗しました: ${err.message}` });
  }
});

async function generateExcelStructure(instruction, context) {
  const system = `あなたは資料の内容をもとにExcel形式のデータ構造を作成するアシスタントです。
以下のコンテキストをもとに、ユーザーの指示に沿った表データをJSON形式のみで出力してください。
前置き・説明文・コードブロック記号は一切含めず、JSONオブジェクトのみを返してください。会話文で応答することは禁止します。

コンテキストの内容が指示と直接関係しない場合でも、JSON以外の形式で応答してはいけません。その場合は、シートの1行目に「コンテキスト内に直接関連する記載が見つかりませんでした」といった説明を入れた上で、コンテキストから分かる範囲の関連情報を表にまとめてください。

出力形式:
{
  "sheets": [
    { "name": "シート名", "headers": ["列名1", "列名2"], "rows": [["値1", "値2"], ["値3", "値4"]] }
  ]
}

コンテキスト:
---
${context}
---`;
  return await callClaudeForJson(system, instruction);
}

async function generatePptxStructure(instruction, context) {
  const system = `あなたは資料の内容をもとにPowerPointスライドの構成を作成するアシスタントです。
以下のコンテキストをもとに、ユーザーの指示に沿ったスライド構成をJSON形式のみで出力してください。
前置き・説明文・コードブロック記号は一切含めず、JSONオブジェクトのみを返してください。会話文で応答することは禁止します。

コンテキストの内容が指示と直接関係しない場合でも、JSON以外の形式で応答してはいけません。その場合は、1枚目のスライドの見出しを「関連する記載が見つかりませんでした」とし、bulletsにコンテキストから分かる範囲の関連情報を入れてください。

出力形式:
{
  "slides": [
    { "title": "スライドタイトル", "bullets": ["要点1", "要点2", "要点3"] }
  ]
}

コンテキスト:
---
${context}
---`;
  return await callClaudeForJson(system, instruction);
}

async function callClaudeForJson(system, instruction) {
  // "{" から書き始めさせることで、会話文ではなくJSONとして応答することを強制する
  const text = await callClaude({
    system,
    message: instruction,
    maxTokens: 2048,
    assistantPrefill: '{',
  });
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('AIの出力をJSONとして解釈できませんでした。指示文を変えて再試行してください');
  }
}

async function buildExcelFile(structure, filePath) {
  const workbook = new ExcelJS.Workbook();
  for (const sheetDef of structure.sheets) {
    const sheet = workbook.addWorksheet(sheetDef.name || 'Sheet1');
    sheet.addRow(sheetDef.headers);
    sheet.getRow(1).font = { bold: true };
    sheetDef.rows.forEach(row => sheet.addRow(row));
    sheet.columns.forEach(col => { col.width = 20; });
  }
  await workbook.xlsx.writeFile(filePath);
}

async function buildPptxFile(structure, filePath) {
  const pres = new pptxgen();
  for (const slideDef of structure.slides) {
    const slide = pres.addSlide();
    slide.addText(slideDef.title, { x: 0.5, y: 0.3, w: 9, fontSize: 24, bold: true });
    const bulletItems = (slideDef.bullets || []).map(b => ({
      text: b,
      options: { bullet: true, breakLine: true },
    }));
    slide.addText(bulletItems, { x: 0.5, y: 1.3, w: 9, h: 4.5, fontSize: 16 });
  }
  await pres.writeFile({ fileName: filePath });
}

module.exports = router;
