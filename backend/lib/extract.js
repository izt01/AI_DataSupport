const xlsx = require('xlsx');
const AdmZip = require('adm-zip');
const { parseStringPromise } = require('xml2js');
const fs = require('fs');

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

async function extractSegments(filePath, ext) {
  if (ext === 'xlsx') return extractXlsxSegments(filePath);
  if (ext === 'pptx') return await extractPptxSegments(filePath);
  throw new Error(`未対応の形式: ${ext}`);
}

module.exports = { extractSegments };
