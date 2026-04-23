import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import keywordsRouter from './src/routes/keywords.js';
import auditRouter from './src/routes/audit.js';
import competitorsRouter from './src/routes/competitors.js';
import contentRouter from './src/routes/content.js';
import gscRouter from './src/routes/gsc.js';
import blogRouter from './src/routes/blog.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/keywords', keywordsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/competitors', competitorsRouter);
app.use('/api/content', contentRouter);
app.use('/api/gsc', gscRouter);
app.use('/api/blog', blogRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

app.listen(PORT, () => {
  console.log(`SEO Tool Backend running on http://localhost:${PORT}`);
});
