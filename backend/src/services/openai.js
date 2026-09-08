import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_BASE_URL = 'https://khoaapi.duckdns.org/v1';
const DEFAULT_MODEL = 'cx/gpt-5.5';

// Built lazily (not at module import time) so the server can still start
// and serve the Settings page when no API key is configured yet.
function getClient() {
  const apiKey = process.env.GPT_CHAT_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL = (process.env.GPT_CHAT_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');

  if (!apiKey) {
    throw new Error('OpenAI API key is not configured. Please set GPT_CHAT_API_KEY or OPENAI_API_KEY.');
  }

  return new OpenAI({ apiKey, baseURL });
}

function getModel() {
  return process.env.GPT_CHAT_MODEL || DEFAULT_MODEL;
}

export async function chatCompletion(systemPrompt, userPrompt, options = {}) {
  const openai = getClient();
  const payload = {
    model: getModel(),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 4000,
    response_format: options.json ? { type: 'json_object' } : undefined,
  };

  let response;
  try {
    response = await openai.chat.completions.create(payload);
  } catch (error) {
    if (!payload.response_format) throw error;

    delete payload.response_format;
    response = await openai.chat.completions.create(payload);
  }

  return response.choices[0].message.content;
}

export async function streamCompletion(systemPrompt, userPrompt, res) {
  const openai = getClient();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const stream = await openai.chat.completions.create({
    model: getModel(),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 6000,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }

  res.write('data: [DONE]\n\n');
  res.end();
}
