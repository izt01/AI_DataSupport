const OpenAI = require('openai');
const openai = new OpenAI(); // OPENAI_API_KEY 環境変数を自動で参照

function splitIntoChunks(text, size = 700, overlap = 100) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + size));
    start += size - overlap;
  }
  return chunks.filter(c => c.trim().length > 0);
}

async function embedText(text) {
  const { data } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return data[0].embedding;
}

module.exports = { splitIntoChunks, embedText };
