async function callClaude({ system, message, maxTokens = 1024, assistantPrefill }) {
  const messages = [{ role: 'user', content: message }];
  if (assistantPrefill) {
    // アシスタントの回答の書き出しをこちらで指定し、そこから続きを書かせる
    // (例: "{" を指定すると、会話文ではなくJSONとして書き始めさせられる)
    messages.push({ role: 'assistant', content: assistantPrefill });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error?.message || `APIエラー (${response.status})`);
  }
  const text = result.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');

  // プリフィルした部分はAPIのレスポンスに含まれないため、こちらで復元する
  return assistantPrefill ? assistantPrefill + text : text;
}

module.exports = { callClaude };
