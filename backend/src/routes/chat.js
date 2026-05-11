import { Router } from 'express';
import {
  buildChatMessages,
  createGptChatCompletion,
  streamGptChatCompletion,
} from '../services/gptChat.js';

const router = Router();

router.post('/message', async (req, res) => {
  try {
    const { messages, systemPrompt, temperature, max_tokens } = req.body;
    const chatMessages = buildChatMessages(messages, systemPrompt);
    const result = await createGptChatCompletion(chatMessages, { temperature, max_tokens });

    res.json(result);
  } catch (err) {
    console.error('GPT chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/stream', async (req, res) => {
  try {
    const { messages, systemPrompt, temperature, max_tokens } = req.body;
    const chatMessages = buildChatMessages(messages, systemPrompt);

    await streamGptChatCompletion(chatMessages, res, { temperature, max_tokens });
  } catch (err) {
    console.error('GPT chat stream error:', err);

    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    res.status(500).json({ error: err.message });
  }
});

export default router;
