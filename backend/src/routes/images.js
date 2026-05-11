import { Router } from 'express';
import multer from 'multer';
import { createSeoImage, editSeoImage } from '../services/gptImage.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    if (!file.mimetype?.startsWith('image/')) {
      callback(new Error('Only image uploads are allowed'));
      return;
    }

    callback(null, true);
  },
});

router.post('/seo', async (req, res) => {
  try {
    const { topic } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: 'topic is required' });
    }

    const result = await createSeoImage(req.body);
    res.json(result);
  } catch (err) {
    console.error('SEO image generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/seo/edit', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'image file is required' });
    }

    const result = await editSeoImage(req.file, {
      ...req.body,
      includeText: req.body.includeText === 'true',
    });

    res.json(result);
  } catch (err) {
    console.error('SEO image edit error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
