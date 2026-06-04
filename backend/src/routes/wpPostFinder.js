import { Router } from 'express';
import { searchWpPostsByH1 } from '../services/wpPostFinder.js';

const router = Router();

function getErrorStatus(error) {
  return /Thiếu|Cần|không hợp lệ|required/i.test(error?.message || '') ? 400 : 500;
}

function readPayload(body = {}) {
  return {
    wpUrl: body.wpUrl,
    wpUsername: body.wpUsername,
    wpAppPassword: body.wpAppPassword,
    phrase: body.phrase,
    maxItems: body.maxItems,
    status: body.status,
  };
}

router.post('/search', async (req, res) => {
  try {
    const result = await searchWpPostsByH1(readPayload(req.body));
    res.json(result);
  } catch (err) {
    const status = getErrorStatus(err);
    if (status >= 500) {
      console.error('WP post finder error:', err);
    }
    res.status(status).json({ error: err.message });
  }
});

export default router;
