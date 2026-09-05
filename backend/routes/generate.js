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
  const { projectId, documentId, format, instruction } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: 'projectIdを指定してください' });
  }
  if (!['xlsx', 'pptx'].includes(format)) {
    return res.status(400).json({ error: '出力形式は xlsx または pptx を指定してください' });
  }
  if (!instruction || !instruction.trim()) {
    return res.status(400).json({ error: '生成したい内容を指示文で入力してください' });
  }

  try {
    const rows = await retrieveContext(projectId, documentId, instruction, 24);
    const context = rows
      .map(r => `[${r.source_label}]\n${r.content}`)
      .join('\n\n---\n\n');

    const structured = format === 'xlsx'
      ? await generateExcelStructure(instruction, context)
      : await generatePptxStructure(instruction, context);

    fs.mkdirSync(GENERATED_DIR, { recursive: true });
    const baseName = buildFileNameBase(structured.title || instruction);
    const fileName = `${baseName}_${Date.now()}.${format}`;
    const filePath = path.join(GENERATED_DIR, fileName);

    if (format === 'xlsx') {
      await buildExcelFile(structured, filePath);
    } else {
      await buildPptxFile(structured, filePath);
    }

    res.json({ downloadUrl: `/generated/${encodeURIComponent(fileName)}`, fileName });
  } catch (err) {
    res.status(500).json({ error: `生成に失敗しました: ${err.message}` });
  }
});

// ファイル名に使えない文字を除去し、長さを整える
function buildFileNameBase(text) {
  const cleaned = String(text || '')
    .replace(/[\\/:*?"<>|]/g, '') // Windows/Excelで使えない記号を除去
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 30);
  return cleaned || '資料';
}

async function generateExcelStructure(instruction, context) {
  const system = `あなたは資料の内容をもとにExcel形式のデータ構造を作成するアシスタントです。

以下の「資料抜粋」は、アップロード済みの資料からユーザーの指示に関連する箇所を検索して抜き出したものです。これは実際に存在する資料の内容であり、あなたには必ず資料の内容が渡されています。

出力ルール:
- 前置き・説明文・コードブロック記号は一切含めず、JSONオブジェクトのみを返してください。会話文で応答することは禁止します。
- 資料抜粋に直接的な記載がある場合は、それを表にまとめてください。
- 直接的な記載がなくても、資料抜粋の内容から合理的に要約・推測できる場合は、推測であることが分かる列(例:「備考」列に「資料の記載から推測」等)を設けた上で、必ず具体的な内容を埋めてください。空欄のまま残すことは禁止します。
- 「関連する記載が見つかりませんでした」という一言だけのシートは禁止します。関連しそうな情報が資料抜粋に少しでもあれば、それを掘り下げて表にしてください。
- 内容は可能な限り具体的に(項目名・値・理由などを分けた列構成で)作成してください。単なる一覧化ではなく、読み手が理解しやすいよう「大項目」「中項目」「詳細」のように階層立てて整理してください。
- 資料抜粋に含まれる項目・要素は、抜け漏れなくすべて拾い上げてください。1つの大項目にまとめず、資料抜粋に出てくる個々のテーブル名・カラム名・機能名・設定項目などをそれぞれ1行ずつ、粒度を細かく分解して書き出してください。要約しすぎて情報を削らないこと。
- 行数が多くなっても構いません。網羅性を優先してください。
- 各シートには必ず"description"(文章による説明)を付けてください。表を並べるだけでなく、「このシートが何について書かれているか」「表の内容をどう読めばよいか」「特に注目すべき点」などを2〜4文程度の文章でまとめてください。表の内容の単純な繰り返しではなく、要点や背景を補足する文章にしてください。
- シート名は各シートの内容が分かる短い名前にしてください。

出力形式:
{
  "title": "この資料全体を表す10〜20文字程度の短い題名(ファイル名に使うため記号は避ける)",
  "sheets": [
    {
      "name": "シート名",
      "description": "このシートの内容についての説明文(2〜4文程度)",
      "headers": ["列名1", "列名2"],
      "rows": [["値1", "値2"], ["値3", "値4"]]
    }
  ]
}

---
資料抜粋:
${context}
---`;
  return await callClaudeForJson(system, instruction);
}

async function generatePptxStructure(instruction, context) {
  const system = `あなたは資料の内容をもとにPowerPointスライドの構成を作成するアシスタントです。

以下の「資料抜粋」は、アップロード済みの資料からユーザーの指示に関連する箇所を検索して抜き出したものです。これは実際に存在する資料の内容であり、あなたには必ず資料の内容が渡されています。

出力ルール:
- 前置き・説明文・コードブロック記号は一切含めず、JSONオブジェクトのみを返してください。会話文で応答することは禁止します。
- 資料抜粋に直接的な記載がある場合は、それをスライドにまとめてください。
- 直接的な記載がなくても、資料抜粋の内容から合理的に要約・推測できる場合は、推測であることが分かるようbulletsに明記した上で、必ず具体的な内容を書いてください。空のスライドは禁止します。
- 「関連する記載が見つかりませんでした」という一言だけのスライドは禁止します。関連しそうな情報が資料抜粋に少しでもあれば、それを掘り下げて複数のスライドに分けてください。
- 資料抜粋に含まれる項目・要素は、抜け漏れなくすべて拾い上げてください。1枚のスライドに詰め込みすぎず、内容のまとまりごとにスライドを分けて枚数を増やしてください。要約しすぎて情報を削らないこと。
- 1枚のスライドにbulletsを詰め込みすぎず(目安5〜7項目まで)、内容のまとまりごとにスライドを分けてください。

出力形式:
{
  "title": "この資料全体を表す10〜20文字程度の短い題名(ファイル名に使うため記号は避ける)",
  "slides": [
    { "title": "スライドタイトル", "bullets": ["要点1", "要点2", "要点3"] }
  ]
}

---
資料抜粋:
${context}
---`;
  return await callClaudeForJson(system, instruction);
}

async function callClaudeForJson(system, instruction) {
  const text = await callClaude({ system, message: instruction, maxTokens: 8192 });

  // コードブロック記号を除去したうえで、念のため最初の "{" 〜 最後の "}" だけを抜き出す
  // (AIが前後に説明文を付けてしまった場合でも、JSON部分だけを回収できるようにする)
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const jsonSlice = (start !== -1 && end !== -1 && end > start)
    ? cleaned.slice(start, end + 1)
    : cleaned;

  try {
    return JSON.parse(jsonSlice);
  } catch {
    throw new Error('AIの出力をJSONとして解釈できませんでした。指示文を変えて再試行してください');
  }
}

async function buildExcelFile(structure, filePath) {
  const workbook = new ExcelJS.Workbook();

  // 配色(アプリのテーマに合わせた落ち着いた配色)。文字サイズは役割ごとに差をつける:
  // 表題(18pt) > ヘッダー(13pt) > 本文(11pt) > 説明文・備考など補足(9.5pt)
  const FONT_NAME = 'Yu Gothic';
  const TITLE_FONT = { name: FONT_NAME, bold: true, size: 18, color: { argb: 'FF2C5049' } };
  const HEADER_FONT = { name: FONT_NAME, bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3F6E62' } };
  const BAND_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F0E8' } };
  const BODY_FONT = { name: FONT_NAME, size: 11, color: { argb: 'FF232620' } };
  const NOTE_FONT = { name: FONT_NAME, size: 9.5, color: { argb: 'FF6B6656' } };
  const BORDER_COLOR = { argb: 'FFD9D5C9' };
  const THIN_BORDER = {
    top: { style: 'thin', color: BORDER_COLOR },
    left: { style: 'thin', color: BORDER_COLOR },
    bottom: { style: 'thin', color: BORDER_COLOR },
    right: { style: 'thin', color: BORDER_COLOR },
  };

  const DESCRIPTION_FONT = { name: FONT_NAME, size: 9.5, italic: true, color: { argb: 'FF6B6656' } };

  // 「備考」「注釈」などのように補足情報を表す列名(サブテキストとして小さめのフォントにする)
  const NOTE_HEADER_PATTERN = /備考|注記|注釈|補足|メモ|note/i;

  (structure.sheets || []).forEach((sheetDef, sheetIndex) => {
    const rawName = sheetDef.name || `シート${sheetIndex + 1}`;
    // Excelでシート名に使えない文字を除去し、31文字以内に収める
    const safeName = rawName.replace(/[:\\/?*[\]]/g, '').slice(0, 31) || `シート${sheetIndex + 1}`;

    const headers = sheetDef.headers && sheetDef.headers.length ? sheetDef.headers : ['内容'];
    const dataRows = sheetDef.rows || [];
    const colCount = headers.length;
    const description = (sheetDef.description || '').trim();
    const noteColumnIndexes = new Set(
      headers.map((h, idx) => (NOTE_HEADER_PATTERN.test(String(h)) ? idx : -1)).filter(idx => idx >= 0)
    );

    // 説明文がある場合は「タイトル+説明文+ヘッダー」の3行、なければ2行を固定表示にする
    const frozenRows = description ? 3 : 2;
    const sheet = workbook.addWorksheet(safeName, {
      views: [{ state: 'frozen', ySplit: frozenRows }],
    });

    // ---- タイトル行(シート名を大きく表示) ----
    sheet.mergeCells(1, 1, 1, colCount);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = rawName;
    titleCell.font = TITLE_FONT;
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(1).height = 32;

    // ---- 説明文行(表の内容を文章で補足。サブテキストとして小さめのフォントにする) ----
    if (description) {
      sheet.mergeCells(2, 1, 2, colCount);
      const descCell = sheet.getCell(2, 1);
      descCell.value = description;
      descCell.font = DESCRIPTION_FONT;
      descCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      // おおよその折り返し行数から高さを見積もる(結合セルの横幅の目安を70文字として計算)
      const estimatedLines = Math.max(1, Math.ceil(description.length / 70));
      sheet.getRow(2).height = Math.min(Math.max(estimatedLines * 14, 22), 160);
    }

    // ---- ヘッダー行 ----
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell(cell => {
      cell.font = HEADER_FONT;
      cell.fill = HEADER_FILL;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = THIN_BORDER;
    });
    headerRow.height = 26;

    // ---- データ行(1行おきに背景色を変えて縞模様に。備考系の列は小さめのフォントに) ----
    dataRows.forEach((rowData, i) => {
      const row = sheet.addRow(rowData);
      const isBand = i % 2 === 1;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = noteColumnIndexes.has(colNumber - 1) ? NOTE_FONT : BODY_FONT;
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        cell.border = THIN_BORDER;
        if (isBand) cell.fill = BAND_FILL;
      });
      row.height = 20;
    });

    // ---- 列幅を内容の長さに応じて自動調整 ----
    headers.forEach((header, idx) => {
      const columnValues = dataRows.map(r => String(r[idx] ?? ''));
      const longest = columnValues.reduce((max, v) => Math.max(max, v.length), String(header).length);
      sheet.getColumn(idx + 1).width = Math.min(Math.max(longest + 4, 12), 45);
    });
  });

  await workbook.xlsx.writeFile(filePath);
}

async function buildPptxFile(structure, filePath) {
  const pres = new pptxgen();
  const ACCENT = '3F6E62';
  const TEXT_DARK = '232620';
  const FONT_NAME = 'Yu Gothic';

  (structure.slides || []).forEach(slideDef => {
    const slide = pres.addSlide();

    // タイトル帯(背景色付き)
    slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 1.0, fill: { color: ACCENT } });
    slide.addText(slideDef.title || '', {
      x: 0.5, y: 0, w: 9, h: 1.0,
      fontSize: 24, bold: true, color: 'FFFFFF', fontFace: FONT_NAME,
      valign: 'middle',
    });

    // 「※」「注:」「(注)」などで始まる箇条書きは注釈とみなし、フォントを少し小さくする
    const NOTE_BULLET_PATTERN = /^\s*(※|注[:：]|\(注\)|補足[:：])/;
    const bulletItems = (slideDef.bullets || []).map(b => {
      const isNote = NOTE_BULLET_PATTERN.test(b);
      return {
        text: b,
        options: {
          bullet: { code: '25A0', indent: 20 },
          breakLine: true,
          color: isNote ? '6B6656' : TEXT_DARK,
          fontFace: FONT_NAME,
          fontSize: isNote ? 12 : 16,
          italic: isNote,
        },
      };
    });
    slide.addText(bulletItems, {
      x: 0.6, y: 1.3, w: 8.8, h: 4.8,
      fontSize: 16, lineSpacing: 28, fontFace: FONT_NAME,
    });
  });

  await pres.writeFile({ fileName: filePath });
}

module.exports = router;
