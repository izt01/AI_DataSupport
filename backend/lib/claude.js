async function callClaude({ system, message, maxTokens = 1024 }) {
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
      messages: [{ role: 'user', content: message }],
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error?.message || `APIエラー (${response.status})`);
  }
  return result.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');
}

module.exports = { callClaude };
