import express from 'express';
import { getSettings, updateSettings, SETTINGS_FIELDS } from '../config/settingsStore.js';

const router = express.Router();

function isDesktopMode() {
  return process.env.SEO_TOOL_DESKTOP === '1';
}

function maskValue(value) {
  if (!value) return '';
  if (value.length <= 4) return '****';
  return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
}

router.use((req, res, next) => {
  if (!isDesktopMode()) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
});

router.get('/', (req, res) => {
  const saved = getSettings();
  const fields = SETTINGS_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    secret: field.secret,
    configured: Boolean(process.env[field.key]),
    value: field.secret
      ? maskValue(saved[field.key] || '')
      : (saved[field.key] || process.env[field.key] || ''),
  }));
  res.json({ fields });
});

router.post('/', (req, res) => {
  const body = req.body || {};
  const allowedKeys = new Set(SETTINGS_FIELDS.map((f) => f.key));
  const partial = {};

  for (const [key, value] of Object.entries(body)) {
    if (allowedKeys.has(key)) {
      partial[key] = typeof value === 'string' ? value.trim() : value;
    }
  }

  updateSettings(partial);
  res.json({ ok: true });
});

export default router;
