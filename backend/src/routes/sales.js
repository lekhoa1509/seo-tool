import axios from 'axios';
import * as cheerio from 'cheerio';
import { Router } from 'express';
import {
  buildChatMessages,
  createGptChatCompletion,
} from '../services/gptChat.js';

const router = Router();

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; SEOProSalesBot/1.0)',
  'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
};

function cleanText(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value = '', max = 500) {
  const text = cleanText(value);
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text;
}

function ensureUrl(value = '') {
  const input = cleanText(value);
  if (!input) return '';
  return input.startsWith('http://') || input.startsWith('https://') ? input : `https://${input}`;
}

function parseJsonText(text) {
  const cleaned = String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('AI returned invalid JSON');
  }
}

async function jsonCompletion(systemPrompt, userPrompt, options = {}) {
  const result = await createGptChatCompletion(
    buildChatMessages([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]),
    { json: true, temperature: 0.45, max_tokens: 6000, ...options }
  );

  return {
    data: parseJsonText(result.content),
    model: result.model,
  };
}

function collectTexts($, selector, minLength = 2, maxItems = 12) {
  const items = [];
  const seen = new Set();

  $(selector).each((_, element) => {
    const text = truncateText($(element).text(), 220);
    const key = text.toLowerCase();
    if (!text || text.length < minLength || seen.has(key)) return;
    seen.add(key);
    items.push(text);
  });

  return items.slice(0, maxItems);
}

function extractJsonLdTypes($) {
  const types = new Set();

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const graph = Array.isArray(parsed?.['@graph']) ? parsed['@graph'] : [];
      const nodes = Array.isArray(parsed) ? parsed : [parsed, ...graph];
      nodes.forEach((node) => {
        const type = node?.['@type'];
        if (Array.isArray(type)) type.forEach((item) => types.add(item));
        if (typeof type === 'string') types.add(type);
      });
    } catch {}
  });

  return [...types];
}

async function fetchPageSummary(url) {
  if (!url) return null;
  const normalizedUrl = ensureUrl(url);

  const response = await axios.get(normalizedUrl, {
    timeout: 18000,
    headers: REQUEST_HEADERS,
    maxRedirects: 4,
  });

  const $ = cheerio.load(response.data);
  const bodyText = cleanText($('main').text() || $('article').text() || $('body').text());
  const base = new URL(normalizedUrl);
  const ctas = [];
  const internalLinks = [];

  $('a[href], button').each((_, element) => {
    const text = truncateText($(element).text(), 90);
    const href = $(element).attr('href') || '';
    if (/mua|bao gia|lien he|tu van|dat hang|goi|zalo|nhan|quote|buy|contact|call/i.test(`${text} ${href}`)) {
      ctas.push({ text, href });
    }

    if (href) {
      try {
        const linkUrl = new URL(href, normalizedUrl);
        if (linkUrl.hostname === base.hostname && text) {
          internalLinks.push({ text, url: linkUrl.toString() });
        }
      } catch {}
    }
  });

  return {
    url: normalizedUrl,
    statusCode: response.status,
    title: truncateText($('title').text(), 160),
    metaDescription: truncateText(
      $('meta[name="description"]').attr('content')
        || $('meta[property="og:description"]').attr('content')
        || '',
      240
    ),
    h1: collectTexts($, 'h1', 2, 4),
    h2: collectTexts($, 'h2', 2, 12),
    ctas: ctas.slice(0, 10),
    internalLinks: internalLinks.slice(0, 20),
    schemaTypes: extractJsonLdTypes($),
    wordCount: bodyText.split(/\s+/).filter(Boolean).length,
    bodySample: truncateText(bodyText, 2200),
  };
}

async function safeFetchPageSummary(url) {
  try {
    return await fetchPageSummary(url);
  } catch (error) {
    return {
      url: ensureUrl(url),
      error: error.message,
    };
  }
}

function splitLines(value = '') {
  return String(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseList(value = '') {
  return splitLines(value).map((line) => line.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
}

function parseNumber(value) {
  if (typeof value === 'number') return value;
  const cleaned = String(value || '')
    .replace('%', '')
    .replace(/,/g, '')
    .trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeHeader(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\w]/g, '');
}

function parseMetricRows(raw = '') {
  const lines = splitLines(raw);
  if (!lines.length) return [];

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delimiter).map(normalizeHeader);

  const indexOf = (...names) => headers.findIndex((header) => names.includes(header));
  const queryIndex = indexOf('query', 'keyword', 'tukhoatruyvan', 'truyvan');
  const pageIndex = indexOf('page', 'url', 'landingpage', 'trang');
  const clicksIndex = indexOf('clicks', 'click', 'soluotnhap');
  const impressionsIndex = indexOf('impressions', 'impression', 'hienthi', 'solanhienthi');
  const ctrIndex = indexOf('ctr', 'tylenhap');
  const positionIndex = indexOf('position', 'avgposition', 'averageposition', 'vitritrungbinh');

  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter).map((cell) => cell.trim());
    const ctrValue = parseNumber(cells[ctrIndex]);
    return {
      query: cells[queryIndex] || '',
      page: cells[pageIndex] || '',
      clicks: parseNumber(cells[clicksIndex]),
      impressions: parseNumber(cells[impressionsIndex]),
      ctr: ctrValue > 1 ? ctrValue / 100 : ctrValue,
      position: parseNumber(cells[positionIndex]),
    };
  }).filter((row) => row.query || row.page);
}

function getOpportunityType(row) {
  if (row.position > 3 && row.position <= 10) return 'push_to_top_3';
  if (row.position > 10 && row.position <= 20) return 'page_refresh';
  if (row.position <= 3 && row.ctr < 0.04 && row.impressions >= 100) return 'ctr_rewrite';
  if (row.impressions >= 500 && row.clicks <= 5) return 'intent_mismatch';
  return 'monitor';
}

function scoreOpportunity(row) {
  const positionScore = row.position > 3 && row.position <= 10
    ? 45
    : row.position > 10 && row.position <= 20
      ? 32
      : row.position <= 3
        ? 24
        : 12;
  const impressionScore = Math.min(35, Math.log10(Math.max(row.impressions, 1)) * 10);
  const ctrGap = row.position <= 3 ? Math.max(0, 0.18 - row.ctr) : Math.max(0, 0.08 - row.ctr);
  const ctrScore = Math.min(20, ctrGap * 120);
  return Math.round(positionScore + impressionScore + ctrScore);
}

function analyzeRankOpportunities(rawMetrics = '') {
  const rows = parseMetricRows(rawMetrics);
  const opportunities = rows
    .map((row) => ({
      ...row,
      opportunityType: getOpportunityType(row),
      opportunityScore: scoreOpportunity(row),
      estimatedMissedClicks: Math.max(0, Math.round((row.impressions * 0.08) - row.clicks)),
    }))
    .sort((left, right) => right.opportunityScore - left.opportunityScore)
    .slice(0, 25);

  const totals = rows.reduce((acc, row) => ({
    clicks: acc.clicks + row.clicks,
    impressions: acc.impressions + row.impressions,
    missedClicks: acc.missedClicks + Math.max(0, Math.round((row.impressions * 0.08) - row.clicks)),
  }), { clicks: 0, impressions: 0, missedClicks: 0 });

  return {
    totalRows: rows.length,
    totals,
    opportunities,
  };
}

function buildSystemPrompt(role) {
  return `You are a senior SEO and digital sales strategist for organic growth, not paid ads.
Focus on revenue, leads, conversion intent, landing pages, internal links, SERP gaps, CRO, and schema.
Always return valid JSON only. Be concrete, practical, and suitable for Vietnamese businesses. Role: ${role}.`;
}

router.post('/dashboard', async (req, res) => {
  try {
    const {
      businessName,
      siteUrl,
      offer,
      targetMarket = 'Vietnam',
      rawMetrics = '',
    } = req.body;

    const rankData = analyzeRankOpportunities(rawMetrics);
    const siteSummary = siteUrl ? await safeFetchPageSummary(siteUrl) : null;

    const { data, model } = await jsonCompletion(
      buildSystemPrompt('Organic sales dashboard analyst'),
      `Build an organic sales SEO dashboard plan.

Business: ${businessName || 'Not specified'}
Site: ${siteUrl || 'Not specified'}
Offer: ${offer || 'Not specified'}
Target market: ${targetMarket}
Site summary: ${JSON.stringify(siteSummary)}
GSC/rank opportunity data: ${JSON.stringify(rankData)}

Return JSON:
{
  "scorecard": {
    "organicSalesScore": 72,
    "trafficQuality": 70,
    "conversionReadiness": 64,
    "moneyPageCoverage": 58,
    "internalLinkStrength": 62
  },
  "summary": "2-3 sentence diagnosis",
  "salesFunnel": [
    { "stage": "awareness|consideration|purchase|retention", "currentState": "short finding", "mainGap": "gap", "nextAction": "action" }
  ],
  "topOpportunities": [
    { "priority": 1, "opportunity": "specific opportunity", "impact": "lead/sales impact", "effort": "low|medium|high", "owner": "SEO|Content|Developer|Sales", "nextStep": "specific next step" }
  ],
  "kpis": [
    { "name": "Organic leads", "whyItMatters": "reason", "trackingMethod": "GA4/GSC/form/call/Zalo tracking" }
  ],
  "weeklyActionPlan": ["action 1", "action 2", "action 3"]
}`,
      { max_tokens: 5000 }
    );

    res.json({ ...data, model, rankData });
  } catch (err) {
    console.error('Sales dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/intent-map', async (req, res) => {
  try {
    const {
      seedKeyword,
      keywords = '',
      businessType = '',
      offer = '',
      targetMarket = 'Vietnam',
    } = req.body;

    if (!seedKeyword && !keywords) {
      return res.status(400).json({ error: 'seedKeyword or keywords is required' });
    }

    const keywordList = parseList(keywords);
    const { data, model } = await jsonCompletion(
      buildSystemPrompt('Keyword intent and funnel mapper'),
      `Map these keywords into sales intent and page types.

Seed keyword: ${seedKeyword || keywordList[0]}
Keyword list: ${JSON.stringify(keywordList)}
Business type: ${businessType || 'Not specified'}
Offer: ${offer || 'Not specified'}
Target market: ${targetMarket}

Return JSON:
{
  "summary": "short funnel diagnosis",
  "keywordMap": [
    {
      "keyword": "keyword",
      "intent": "informational|commercial|transactional|local|navigational",
      "funnelStage": "awareness|consideration|purchase|retention",
      "salesPriority": "high|medium|low",
      "pageType": "blog|category|product|landing-page|comparison|faq|local-page",
      "targetPage": "recommended URL slug",
      "contentAngle": "angle",
      "cta": "CTA for this intent"
    }
  ],
  "clusters": [
    { "cluster": "cluster name", "primaryKeyword": "keyword", "supportingKeywords": ["keyword"], "recommendedPageType": "page type" }
  ],
  "missingMoneyPages": [
    { "page": "page name", "targetKeyword": "keyword", "reason": "why it can sell" }
  ],
  "quickWins": ["specific quick win"]
}`,
      { max_tokens: 6000 }
    );

    res.json({ ...data, model });
  } catch (err) {
    console.error('Intent map error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/money-page', async (req, res) => {
  try {
    const {
      url,
      pageContent = '',
      targetKeyword,
      offer,
      audience = '',
    } = req.body;

    if (!url && !pageContent) {
      return res.status(400).json({ error: 'url or pageContent is required' });
    }

    const pageSummary = url ? await safeFetchPageSummary(url) : { bodySample: truncateText(pageContent, 2500) };
    const { data, model } = await jsonCompletion(
      buildSystemPrompt('Money page optimizer'),
      `Audit this sales SEO money page.

Target keyword: ${targetKeyword || 'Not specified'}
Offer: ${offer || 'Not specified'}
Audience: ${audience || 'Not specified'}
Page summary/content: ${JSON.stringify(pageSummary)}

Return JSON:
{
  "scores": {
    "salesReadiness": 70,
    "searchIntentMatch": 75,
    "ctaClarity": 60,
    "trustSignals": 55,
    "offerClarity": 68,
    "schemaReadiness": 40
  },
  "summary": "short diagnosis",
  "conversionBlockers": [
    { "issue": "issue", "impact": "impact on sales", "fix": "specific fix", "priority": "high|medium|low" }
  ],
  "copyFixes": {
    "headline": ["suggested headline"],
    "aboveTheFold": ["specific change"],
    "cta": ["CTA text"],
    "faq": ["FAQ to add"]
  },
  "proofElements": ["review/testimonial/certificate/photo/data point to add"],
  "offerChecklist": [
    { "item": "pricing/MOQ/shipping/warranty/etc", "status": "present|missing|weak", "recommendation": "fix" }
  ],
  "topActions": ["action 1", "action 2", "action 3"]
}`,
      { max_tokens: 5500 }
    );

    res.json({ ...data, model, pageSummary });
  } catch (err) {
    console.error('Money page error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/internal-links', async (req, res) => {
  try {
    const {
      sourcePages = '',
      moneyPages = '',
      targetKeyword = '',
      siteUrl = '',
    } = req.body;

    if (!sourcePages || !moneyPages) {
      return res.status(400).json({ error: 'sourcePages and moneyPages are required' });
    }

    const { data, model } = await jsonCompletion(
      buildSystemPrompt('Internal link strategist'),
      `Create internal linking opportunities that push SEO traffic to sales pages.

Site: ${siteUrl || 'Not specified'}
Target keyword/theme: ${targetKeyword || 'Not specified'}
Source pages, one per line: ${JSON.stringify(parseList(sourcePages))}
Money pages, one per line: ${JSON.stringify(parseList(moneyPages))}

Return JSON:
{
  "summary": "short diagnosis",
  "opportunities": [
    {
      "sourcePage": "source URL/title",
      "targetMoneyPage": "target URL/title",
      "anchorText": "recommended anchor",
      "contextSentence": "sentence around the link",
      "priority": "high|medium|low",
      "reason": "why this helps rankings/sales"
    }
  ],
  "orphanRisks": ["money page that needs more links"],
  "anchorMix": [
    { "anchorType": "exact|partial|branded|generic", "examples": ["anchor"] }
  ],
  "implementationPlan": ["step 1", "step 2", "step 3"]
}`,
      { max_tokens: 5500 }
    );

    res.json({ ...data, model });
  } catch (err) {
    console.error('Internal links error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/serp-gap', async (req, res) => {
  try {
    const {
      keyword,
      ownUrl,
      competitorUrls = '',
      businessType = '',
    } = req.body;

    if (!keyword) return res.status(400).json({ error: 'keyword is required' });

    const competitors = parseList(competitorUrls).slice(0, 5);
    const [ownPage, ...competitorPages] = await Promise.all([
      ownUrl ? safeFetchPageSummary(ownUrl) : Promise.resolve(null),
      ...competitors.map((url) => safeFetchPageSummary(url)),
    ]);

    const { data, model } = await jsonCompletion(
      buildSystemPrompt('Commercial SERP gap analyst'),
      `Analyze commercial SERP/content gaps for a sales keyword.

Keyword: ${keyword}
Business type: ${businessType || 'Not specified'}
Own page: ${JSON.stringify(ownPage)}
Competitor pages: ${JSON.stringify(competitorPages)}

Return JSON:
{
  "summary": "short gap diagnosis",
  "serpIntent": "what Google likely rewards for this keyword",
  "gapScore": 68,
  "contentGaps": [
    { "gap": "missing element", "competitorEvidence": "what competitors cover", "fix": "what to add", "priority": "high|medium|low" }
  ],
  "commercialGaps": [
    { "gap": "price/comparison/proof/FAQ/etc", "salesImpact": "impact", "fix": "specific fix" }
  ],
  "recommendedSections": [
    { "heading": "H2/H3 suggestion", "intent": "why it matters", "notes": "what to write" }
  ],
  "schemaGaps": ["schema to add"],
  "winPlan": ["action 1", "action 2", "action 3"]
}`,
      { max_tokens: 6000 }
    );

    res.json({ ...data, model, ownPage, competitorPages });
  } catch (err) {
    console.error('SERP gap error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/rank-opportunities', async (req, res) => {
  try {
    const { rawMetrics = '', businessGoal = '' } = req.body;
    if (!rawMetrics) return res.status(400).json({ error: 'rawMetrics is required' });

    const rankData = analyzeRankOpportunities(rawMetrics);
    const { data, model } = await jsonCompletion(
      buildSystemPrompt('GSC rank opportunity analyst'),
      `Turn this rank opportunity data into an action plan.

Business goal: ${businessGoal || 'More organic leads/sales'}
Rank opportunity data: ${JSON.stringify(rankData)}

Return JSON:
{
  "summary": "short diagnosis",
  "priorityGroups": [
    { "group": "CTR rewrites|Top 10 push|Content refresh|Intent mismatch", "count": 3, "action": "what to do" }
  ],
  "actions": [
    {
      "query": "query",
      "page": "url",
      "action": "specific action",
      "expectedImpact": "impact",
      "priority": "high|medium|low"
    }
  ],
  "titleMetaTests": [
    { "query": "query", "currentProblem": "problem", "newTitle": "title", "newMetaDescription": "meta" }
  ],
  "internalLinkTargets": ["page/query to support"]
}`,
      { max_tokens: 5500 }
    );

    res.json({ ...data, model, rankData });
  } catch (err) {
    console.error('Rank opportunities error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/cro-schema', async (req, res) => {
  try {
    const {
      url,
      pageContent = '',
      pageType = 'Product',
      businessName = '',
      offer = '',
      targetKeyword = '',
    } = req.body;

    if (!url && !pageContent) {
      return res.status(400).json({ error: 'url or pageContent is required' });
    }

    const pageSummary = url ? await safeFetchPageSummary(url) : { bodySample: truncateText(pageContent, 2500) };
    const { data, model } = await jsonCompletion(
      buildSystemPrompt('CRO checker and schema generator'),
      `Audit CRO and generate schema for this SEO sales page.

Business: ${businessName || 'Not specified'}
Offer: ${offer || 'Not specified'}
Target keyword: ${targetKeyword || 'Not specified'}
Preferred schema/page type: ${pageType}
Page summary/content: ${JSON.stringify(pageSummary)}

Return JSON:
{
  "croScores": {
    "aboveTheFold": 70,
    "cta": 65,
    "trust": 55,
    "friction": 60,
    "mobileReadiness": 68
  },
  "summary": "short CRO diagnosis",
  "croIssues": [
    { "issue": "issue", "fix": "fix", "priority": "high|medium|low" }
  ],
  "objectionHandling": [
    { "objection": "customer concern", "pageElement": "FAQ/proof/table/copy", "copySuggestion": "copy" }
  ],
  "schemaRecommendation": {
    "type": "Product|Service|LocalBusiness|FAQPage|Article",
    "why": "why this schema",
    "jsonLd": {}
  },
  "faqSchemaItems": [
    { "question": "question", "answer": "answer" }
  ],
  "topActions": ["action 1", "action 2", "action 3"]
}`,
      { max_tokens: 6500 }
    );

    res.json({ ...data, model, pageSummary });
  } catch (err) {
    console.error('CRO/schema error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
