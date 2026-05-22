import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_MODEL = 'cx/gpt-5.5';
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant inside an SEO productivity app.
Answer naturally, be practical, and match the user's language.
When the user asks for SEO, content, coding, or analysis, give concrete steps and useful examples.`;

const ALLOWED_MODELS = new Set([
  'cx/gpt-5.5',
  'cc/claude-opus-4-7',
]);

const MODEL_ALIASES = new Map([
  ['kr/claude-opus-4.7', 'cc/claude-opus-4-7'],
  ['kr/claude-opus-4-7', 'cc/claude-opus-4-7'],
  ['cc/claude-opus-4.7', 'cc/claude-opus-4-7'],
]);

function normalizeModel(model) {
  return MODEL_ALIASES.get(model) || model;
}

function getChatConfig(modelOverride) {
  const apiKey = process.env.GPT_CHAT_API_KEY;
  const baseURL = process.env.GPT_CHAT_BASE_URL?.replace(/\/$/, '');

  if (!apiKey || apiKey.includes('your_')) {
    throw new Error('GPT chat API key is not configured. Please set GPT_CHAT_API_KEY in backend/.env');
  }

  if (!baseURL) {
    throw new Error('GPT chat base URL is not configured. Please set GPT_CHAT_BASE_URL in backend/.env');
  }

  let model = normalizeModel(modelOverride || process.env.GPT_CHAT_MODEL || DEFAULT_MODEL);
  if (!ALLOWED_MODELS.has(model)) {
    model = DEFAULT_MODEL;
  }

  return { apiKey, baseURL, model };
}

function formatChatApiError(errorText, fallbackMessage) {
  const cleaned = String(errorText || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/504 Gateway Time-out/i.test(cleaned)) {
    return 'AI provider bị timeout (504 Gateway Time-out). Hãy thử lại bằng luồng streaming hoặc giảm số từ.';
  }

  return cleaned || fallbackMessage;
}

function normalizeContent(content) {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return '';
  }

  const parts = content
    .map((part) => {
      if (!part || typeof part !== 'object') return null;

      if (part.type === 'text' && typeof part.text === 'string') {
        const text = part.text.trim();
        return text ? { type: 'text', text } : null;
      }

      if (part.type === 'image_url') {
        const url = typeof part.image_url === 'string'
          ? part.image_url
          : part.image_url?.url;

        if (!url) return null;
        return { type: 'image_url', image_url: { url } };
      }

      return null;
    })
    .filter(Boolean);

  if (!parts.length) return '';

  if (parts.length === 1 && parts[0].type === 'text') {
    return parts[0].text;
  }

  return parts;
}

export function buildChatMessages(messages = [], systemPrompt = DEFAULT_SYSTEM_PROMPT) {
  if (!Array.isArray(messages)) {
    throw new Error('messages must be an array');
  }

  const normalized = messages
    .map((message) => {
      if (!message) return null;
      const role = ['system', 'user', 'assistant'].includes(message.role) ? message.role : 'user';
      const content = normalizeContent(message.content);

      if (!content || (Array.isArray(content) && !content.length)) {
        return null;
      }

      return { role, content };
    })
    .filter(Boolean)
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
  const { apiKey, baseURL, model } = getChatConfig(options.model);
  const payload = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 4000,
  };

  if (options.json) {
    payload.response_format = { type: 'json_object' };
  }

  let response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok && payload.response_format) {
    const firstError = await response.text();
    delete payload.response_format;

    response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const retryError = await response.text();
      throw new Error(formatChatApiError(
        retryError || firstError,
        `GPT chat request failed with status ${response.status}`
      ));
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(formatChatApiError(errorText, `GPT chat request failed with status ${response.status}`));
  }

  const data = await response.json();

  return {
    content: data.choices[0]?.message?.content || '',
    model: data.model || model,
  };
}

export async function createGptChatCompletionStream(messages, options = {}) {
  const { apiKey, baseURL, model } = getChatConfig(options.model);
  const payload = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 4000,
    stream: true,
  };

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(formatChatApiError(errorText, `GPT chat stream request failed with status ${response.status}`));
  }

  if (!response.body) {
    throw new Error('GPT chat stream response is empty');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let responseModel = model;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() || '';

    for (const event of events) {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6))
        .join('\n')
        .trim();

      if (!data) continue;
      if (data === '[DONE]') {
        return { content, model: responseModel };
      }

      const parsed = JSON.parse(data);
      responseModel = parsed.model || responseModel;
      content += parsed.choices[0]?.delta?.content || '';
    }
  }

  return { content, model: responseModel };
}

export async function streamGptChatCompletion(messages, res, options = {}) {
  const { apiKey, baseURL, model } = getChatConfig(options.model);
  const writeDone = options.writeDone !== false;
  const endResponse = options.endResponse !== false;

  const finishStream = () => {
    if (writeDone) {
      res.write('data: [DONE]\n\n');
    }

    if (endResponse) {
      res.end();
    }
  };

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  options.onReady?.({ model, res });

  res.write(`event: meta\ndata: ${JSON.stringify({ model })}\n\n`);

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
    throw new Error(formatChatApiError(errorText, `GPT chat stream failed with status ${response.status}`));
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
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() || '';

    for (const event of events) {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6))
        .join('\n')
        .trim();

      if (!data) continue;
      if (data === '[DONE]') {
        finishStream();
        return;
      }

      const parsed = JSON.parse(data);
      const content = parsed.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
  }

  finishStream();
}

export const SUPPORTED_CHAT_MODELS = Array.from(ALLOWED_MODELS);
