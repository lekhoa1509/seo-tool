import { Router } from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import {
  buildChatMessages,
  createGptChatCompletion,
  streamGptChatCompletion,
} from '../services/gptChat.js';
import { createSeoImage } from '../services/gptImage.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.post('/message', async (req, res) => {
  try {
    const { messages, systemPrompt, temperature, max_tokens, model } = req.body;
    const chatMessages = buildChatMessages(messages, systemPrompt);
    const result = await createGptChatCompletion(chatMessages, {
      temperature,
      max_tokens,
      model,
    });

    res.json(result);
  } catch (err) {
    console.error('GPT chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/stream', async (req, res) => {
  try {
    const { messages, systemPrompt, temperature, max_tokens, model } = req.body;
    const chatMessages = buildChatMessages(messages, systemPrompt);

    await streamGptChatCompletion(chatMessages, res, {
      temperature,
      max_tokens,
      model,
    });
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

router.post('/image', async (req, res) => {
  try {
    const { prompt, topic, keyword, size, quality, background, outputFormat } = req.body;
    const text = (prompt || topic || '').trim();

    if (!text) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const result = await createSeoImage({
      topic: text,
      keyword: keyword || text,
      size: size || 'auto',
      quality: quality || 'auto',
      background: background || 'auto',
      outputFormat: outputFormat || 'png',
    });

    res.json(result);
  } catch (err) {
    console.error('Chat image generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file is required' });
    }

    const { mimetype, originalname, buffer, size } = req.file;
    const isImage = mimetype?.startsWith('image/');
    const lowerName = (originalname || '').toLowerCase();
    const isDocx = mimetype === DOCX_MIME || lowerName.endsWith('.docx');

    if (isImage) {
      const dataUrl = `data:${mimetype};base64,${buffer.toString('base64')}`;
      return res.json({
        kind: 'image',
        name: originalname,
        mimeType: mimetype,
        size,
        dataUrl,
      });
    }

    if (isDocx) {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value || '';
      const MAX_CHARS = 80000;
      const truncated = text.length > MAX_CHARS;
      const content = truncated ? text.slice(0, MAX_CHARS) : text;

      return res.json({
        kind: 'text',
        name: originalname,
        mimeType: DOCX_MIME,
        size,
        content,
        truncated,
        format: 'docx',
      });
    }

    const text = buffer.toString('utf8');
    const MAX_CHARS = 60000;
    const truncated = text.length > MAX_CHARS;
    const content = truncated ? text.slice(0, MAX_CHARS) : text;

    res.json({
      kind: 'text',
      name: originalname,
      mimeType: mimetype || 'text/plain',
      size,
      content,
      truncated,
    });
  } catch (err) {
    console.error('Chat upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
