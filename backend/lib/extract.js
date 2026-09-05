const xlsx = require('xlsx');
const AdmZip = require('adm-zip');
const { parseStringPromise } = require('xml2js');
const fs = require('fs');

// 対応するプログラムコード系の拡張子(言語表示にも使う)
const CODE_EXTENSIONS = {
  html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS',
  js: 'JavaScript', jsx: 'JavaScript(JSX)', mjs: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript(TSX)',
  py: 'Python', java: 'Java', c: 'C', h: 'C', cpp: 'C++', cc: 'C++', hpp: 'C++', cs: 'C#',
  rb: 'Ruby', go: 'Go', php: 'PHP', swift: 'Swift', kt: 'Kotlin', rs: 'Rust',
  sql: 'SQL', sh: 'Shell', json: 'JSON', yaml: 'YAML', yml: 'YAML', md: 'Markdown', txt: 'テキスト',
};

const OFFICE_EXTENSIONS = ['xlsx', 'pptx'];

function isCodeExtension(ext) {
  return Object.prototype.hasOwnProperty.call(CODE_EXTENSIONS, ext);
}

function isSupportedExtension(ext) {
  return OFFICE_EXTENSIONS.includes(ext) || isCodeExtension(ext);
}

// xlsx: シート単位でCSV化し、シート名を出典ラベルとして保持
function extractXlsxSegments(filePath) {
  const buffer = fs.readFileSync(filePath);
  const wb = xlsx.read(buffer, { type: 'buffer' });
  return wb.SheetNames.map(name => ({
    label: `シート:${name}`,
    text: xlsx.utils.sheet_to_csv(wb.Sheets[name]),
  }));
}

// pptx: スライド単位でテキストを抽出(zip内のXMLを直接パース)
async function extractPptxSegments(filePath) {
  const zip = new AdmZip(filePath);
  const slideEntries = zip.getEntries()
    .filter(e => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a, b) =>
      parseInt(a.entryName.match(/\d+/)[0], 10) - parseInt(b.entryName.match(/\d+/)[0], 10)
    );

  const segments = [];
  for (const entry of slideEntries) {
    const xml = entry.getData().toString('utf-8');
    const parsed = await parseStringPromise(xml);
    const texts = [];
    JSON.stringify(parsed, (key, value) => {
      if (key === 'a:t' && typeof value === 'string') texts.push(value);
      return value;
    });
    const slideNumber = parseInt(entry.entryName.match(/\d+/)[0], 10);
    segments.push({ label: `スライド${slideNumber}`, text: texts.join('\n') });
  }
  return segments;
}

// プログラムコード: 行番号ベースでチャンク分割し、「ファイル:app.py (L1-60)」のように
// 該当箇所の行範囲が分かるラベルを付ける。チャットでコードを引用する際の根拠として使う。
function extractCodeSegments(filePath, originalName, ext) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split(/\r\n|\r|\n/);
  const linesPerChunk = 60;
  const overlapLines = 10;

  const segments = [];
  let start = 0;
  while (start < lines.length) {
    const end = Math.min(start + linesPerChunk, lines.length);
    const chunkLines = lines.slice(start, end);
    segments.push({
      label: `ファイル:${originalName} (L${start + 1}-${end})`,
      text: chunkLines.join('\n'),
    });
    if (end === lines.length) break;
    start += linesPerChunk - overlapLines;
  }

  // 空ファイル対策
  if (segments.length === 0) {
    segments.push({ label: `ファイル:${originalName}`, text: '' });
  }
  return segments;
}

async function extractSegments(filePath, ext, originalName) {
  if (ext === 'xlsx') return extractXlsxSegments(filePath);
  if (ext === 'pptx') return await extractPptxSegments(filePath);
  if (isCodeExtension(ext)) return extractCodeSegments(filePath, originalName, ext);
  throw new Error(`未対応の形式: ${ext}`);
}

module.exports = { extractSegments, isSupportedExtension, isCodeExtension, CODE_EXTENSIONS };
