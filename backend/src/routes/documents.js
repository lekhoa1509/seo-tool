import { Router } from 'express';
import { buildDocxBuffer } from '../services/docx.js';

const router = Router();
const STORE = new Map();
const MAX_AGE_MS = 1000 * 60 * 60 * 6;

function pruneStore() {
  const now = Date.now();
  for (const [id, entry] of STORE.entries()) {
    if (now - entry.createdAt > MAX_AGE_MS) {
      STORE.delete(id);
    }
  }
}

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeFileName(name) {
  const fallback = 'document';
  const cleaned = String(name || '')
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();

  return cleaned || fallback;
}

router.post('/docx', async (req, res) => {
  try {
    pruneStore();

    const { title, content, fileName } = req.body || {};
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }

    const buffer = await buildDocxBuffer({ title, content });
    const id = makeId();
    const baseName = safeFileName(fileName || title || 'ai-document');
    const finalName = baseName.endsWith('.docx') ? baseName : `${baseName}.docx`;

    STORE.set(id, {
      buffer,
      fileName: finalName,
      title: title || finalName.replace(/\.docx$/, ''),
      content,
      createdAt: Date.now(),
    });

    res.json({
      id,
      fileName: finalName,
      title: title || finalName.replace(/\.docx$/, ''),
      size: buffer.length,
      downloadUrl: `/api/documents/${id}/download`,
      previewUrl: `/api/documents/${id}/preview`,
    });
  } catch (err) {
    console.error('Docx generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/preview', (req, res) => {
  pruneStore();
  const entry = STORE.get(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'Document not found or expired' });
  }
  res.json({
    id: req.params.id,
    fileName: entry.fileName,
    title: entry.title,
    content: entry.content,
    size: entry.buffer.length,
    createdAt: entry.createdAt,
  });
});

router.get('/:id/download', (req, res) => {
  pruneStore();
  const entry = STORE.get(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'Document not found or expired' });
  }

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${entry.fileName}"`);
  res.send(entry.buffer);
});

export default router;
