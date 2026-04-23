import { Router } from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { chatCompletion } from '../services/openai.js';

const router = Router();

async function fetchPageData(url) {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOToolBot/1.0)',
      },
    });

    const html = response.data;
    const $ = cheerio.load(html);
    const startTime = Date.now();

    const data = {
      url,
      statusCode: response.status,
      loadTime: Date.now() - startTime,
      title: $('title').text().trim(),
      metaDescription: $('meta[name="description"]').attr('content') || '',
      metaKeywords: $('meta[name="keywords"]').attr('content') || '',
      canonical: $('link[rel="canonical"]').attr('href') || '',
      robots: $('meta[name="robots"]').attr('content') || '',
      ogTitle: $('meta[property="og:title"]').attr('content') || '',
      ogDescription: $('meta[property="og:description"]').attr('content') || '',
      ogImage: $('meta[property="og:image"]').attr('content') || '',
      h1: [],
      h2: [],
      h3: [],
      images: [],
      links: { internal: 0, external: 0, broken: [] },
      wordCount: 0,
      hasSchema: false,
      hasViewport: false,
      hasHttps: url.startsWith('https'),
    };

    $('h1').each((_, el) => data.h1.push($(el).text().trim()));
    $('h2').each((_, el) => data.h2.push($(el).text().trim()));
    $('h3').each((_, el) => data.h3.push($(el).text().trim()));

    $('img').each((_, el) => {
      data.images.push({
        src: $(el).attr('src') || '',
        alt: $(el).attr('alt') || '',
        hasAlt: !!($(el).attr('alt')),
      });
    });

    const baseUrl = new URL(url);
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !href.startsWith('#') && !href.startsWith('mailto:')) {
        try {
          const linkUrl = new URL(href, url);
          if (linkUrl.hostname === baseUrl.hostname) {
            data.links.internal++;
          } else {
            data.links.external++;
          }
        } catch {}
      }
    });

    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    data.wordCount = bodyText.split(' ').filter(w => w.length > 0).length;

    data.hasSchema = $('script[type="application/ld+json"]').length > 0;
    data.hasViewport = $('meta[name="viewport"]').length > 0;

    return data;
  } catch (err) {
    throw new Error(`Failed to fetch URL: ${err.message}`);
  }
}

router.post('/url', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    let normalizedUrl = url;
    if (!url.startsWith('http')) {
      normalizedUrl = `https://${url}`;
    }

    const pageData = await fetchPageData(normalizedUrl);

    const systemPrompt = `You are a technical SEO expert. Analyze the provided page data and generate a comprehensive SEO audit report in JSON format only.`;

    const userPrompt = `Analyze this page SEO data and provide a detailed audit:

Page Data:
${JSON.stringify(pageData, null, 2)}

Return a JSON audit report with this structure:
{
  "score": 78,
  "grade": "B+",
  "summary": "2-3 sentence overview",
  "pageData": ${JSON.stringify(pageData)},
  "issues": {
    "critical": [
      {
        "id": "missing_h1",
        "title": "Issue Title",
        "description": "What the issue is",
        "impact": "Why this matters for SEO",
        "fix": "How to fix it",
        "category": "on-page|technical|content|performance"
      }
    ],
    "warnings": [],
    "opportunities": []
  },
  "checks": {
    "title": { "status": "pass|fail|warning", "value": "actual value", "recommendation": "..." },
    "metaDescription": { "status": "pass|fail|warning", "value": "...", "recommendation": "..." },
    "h1": { "status": "pass|fail|warning", "value": "...", "recommendation": "..." },
    "canonical": { "status": "pass|fail|warning", "value": "...", "recommendation": "..." },
    "https": { "status": "pass|fail|warning", "value": "...", "recommendation": "..." },
    "viewport": { "status": "pass|fail|warning", "value": "...", "recommendation": "..." },
    "images": { "status": "pass|fail|warning", "value": "...", "recommendation": "..." },
    "schema": { "status": "pass|fail|warning", "value": "...", "recommendation": "..." },
    "wordCount": { "status": "pass|fail|warning", "value": "...", "recommendation": "..." },
    "links": { "status": "pass|fail|warning", "value": "...", "recommendation": "..." }
  },
  "recommendations": ["top priority recommendation 1", "recommendation 2", "recommendation 3"],
  "competitorBenchmarks": {
    "avgTitleLength": 58,
    "avgMetaDescLength": 145,
    "avgWordCount": 1850,
    "avgH2Count": 7
  }
}`;

    const result = await chatCompletion(systemPrompt, userPrompt, { json: true, max_tokens: 5000 });
    res.json(JSON.parse(result));
  } catch (err) {
    console.error('Audit error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/quick', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    let normalizedUrl = url;
    if (!url.startsWith('http')) normalizedUrl = `https://${url}`;

    const pageData = await fetchPageData(normalizedUrl);
    res.json({ success: true, data: pageData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
