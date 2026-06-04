import { Router } from 'express';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import {
  disconnectGoogleAuth,
  getAuthenticatedGoogleClient,
  getGoogleAuthStatus,
  getGoogleAuthUrl,
  handleGoogleOAuthCallback,
  isGoogleConfigured,
} from '../services/googleAuth.js';

dotenv.config();

const router = Router();

router.get('/auth', (req, res) => {
  if (!isGoogleConfigured()) {
    return res.status(400).json({
      error: 'Google OAuth not configured',
      message: 'Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file',
      setupGuide: [
        '1. Go to https://console.cloud.google.com',
        '2. Create a new project or select existing',
        '3. Enable "Google Search Console API"',
        '4. Create OAuth 2.0 credentials',
        '5. Add redirect URI: http://localhost:3001/api/gsc/callback',
        '6. Copy Client ID and Secret to .env file',
      ],
    });
  }

  const authUrl = getGoogleAuthUrl({ returnTo: req.query.returnTo || '/gsc' });

  res.json({ authUrl });
});

router.get('/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const redirectUrl = await handleGoogleOAuthCallback(code, req.query.state);
    res.redirect(redirectUrl);
  } catch (err) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/gsc?error=${encodeURIComponent(err.message)}`);
  }
});

router.get('/status', (req, res) => {
  res.json(getGoogleAuthStatus());
});

router.post('/disconnect', (req, res) => {
  disconnectGoogleAuth();
  res.json({ success: true });
});

router.get('/sites', async (req, res) => {
  try {
    const oauth2Client = getAuthenticatedGoogleClient();
    const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });
    const response = await searchconsole.sites.list();
    res.json({ sites: response.data.siteEntry || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/performance', async (req, res) => {
  try {
    const { siteUrl, startDate, endDate, dimensions = ['query'], rowLimit = 25 } = req.body;

    if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });

    const oauth2Client = getAuthenticatedGoogleClient();
    const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: start,
        endDate: end,
        dimensions,
        rowLimit,
        dataState: 'all',
      },
    });

    res.json({
      siteUrl,
      dateRange: { start, end },
      rows: response.data.rows || [],
      responseAggregationType: response.data.responseAggregationType,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/pages', async (req, res) => {
  try {
    const { siteUrl, startDate, endDate, rowLimit = 25 } = req.body;

    if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });

    const oauth2Client = getAuthenticatedGoogleClient();
    const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: start,
        endDate: end,
        dimensions: ['page'],
        rowLimit,
        orderBy: [{ fieldName: 'impressions', sortOrder: 'DESCENDING' }],
      },
    });

    res.json({
      siteUrl,
      dateRange: { start, end },
      pages: response.data.rows || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/summary', async (req, res) => {
  try {
    const { siteUrl } = req.body;
    if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });

    const oauth2Client = getAuthenticatedGoogleClient();
    const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });

    const end = new Date().toISOString().split('T')[0];
    const start28 = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const start56 = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const mid = start28;

    const [current, previous] = await Promise.all([
      searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: { startDate: start28, endDate: end, dimensions: [] },
      }),
      searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: { startDate: start56, endDate: mid, dimensions: [] },
      }),
    ]);

    const curr = current.data.rows?.[0] || {};
    const prev = previous.data.rows?.[0] || {};

    const pct = (curr, prev) => {
      if (!prev || prev === 0) return 0;
      return (((curr - prev) / prev) * 100).toFixed(1);
    };

    res.json({
      current: {
        clicks: curr.clicks || 0,
        impressions: curr.impressions || 0,
        ctr: ((curr.ctr || 0) * 100).toFixed(2),
        position: (curr.position || 0).toFixed(1),
      },
      changes: {
        clicks: pct(curr.clicks, prev.clicks),
        impressions: pct(curr.impressions, prev.impressions),
        ctr: pct(curr.ctr, prev.ctr),
        position: pct(curr.position, prev.position),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
