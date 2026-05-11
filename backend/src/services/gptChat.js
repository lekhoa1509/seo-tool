import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_MODEL = 'cx/gpt-5.5';
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant inside an SEO productivity app.
Answer naturally, be practical, and match the user's language.
When the user asks for SEO, content, coding, or analysis, give concrete steps and useful examples.`;

function getChatConfig() {
  const apiKey = process.env.GPT_CHAT_API_KEY;
  const baseURL = process.env.GPT_CHAT_BASE_URL?.replace(/\/$/, '');

  if (!apiKey || apiKey.includes('your_')) {
    throw new Error('GPT chat API key is not configured. Please set GPT_CHAT_API_KEY in backend/.env');
  }

  if (!baseURL) {
    throw new Error('GPT chat base URL is not configured. Please set GPT_CHAT_BASE_URL in backend/.env');
  }

  return {
    apiKey,
    baseURL,
    model: process.env.GPT_CHAT_MODEL || DEFAULT_MODEL,
  };
}

export function buildChatMessages(messages = [], systemPrompt = DEFAULT_SYSTEM_PROMPT) {
  if (!Array.isArray(messages)) {
    throw new Error('messages must be an array');
  }

  const normalized = messages
    .filter((message) => message && typeof message.content === 'string')
    .map((message) => ({
      role: ['system', 'user', 'assistant'].includes(message.role) ? message.role : 'user',
      content: message.content.trim(),
    }))
    .filter((message) => message.content)
    .slice(-40);

  if (!normalized.length) {
    throw new Error('At least one message is required');
  }

  const hasSystemMessage = normalized.some((message) => message.role === 'system');
  return hasSystemMessage
    ? normalized
    : [{ role: 'system', content: systemPrompt }, ...normalized];
}

export async function createGptChatCompletion(messages, options = {}) {
  const { apiKey, baseURL, model } = getChatConfig();
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 4000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `GPT chat request failed with status ${response.status}`);
  }

  const data = await response.json();

  return {
    content: data.choices[0]?.message?.content || '',
    model: data.model || model,
  };
}

export async function streamGptChatCompletion(messages, res, options = {}) {
  const { apiKey, baseURL, model } = getChatConfig();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 4000,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `GPT chat stream failed with status ${response.status}`);
  }

  if (!response.body) {
    throw new Error('GPT chat stream response is empty');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const event of events) {
      const data = event
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6))
        .join('\n');

      if (!data) continue;
      if (data === '[DONE]') {
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      const parsed = JSON.parse(data);
      const content = parsed.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
  }

  res.write('data: [DONE]\n\n');
  res.end();
}
