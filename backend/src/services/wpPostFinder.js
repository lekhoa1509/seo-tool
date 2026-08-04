import * as cheerio from 'cheerio';

const DEFAULT_MAX_ITEMS = 500;
const DEFAULT_PHRASE = 'tốt nhất';
const MAX_ITEMS_LIMIT = 2000;
const WP_POST_STATUSES = new Set(['publish', 'draft', 'pending', 'private', 'future', 'any']);

function stripTrailingSlash(value = '') {
  return String(value || '').replace(/\/+$/, '');
}

function decodeHtmlEntities(value = '') {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'");
}

function stripHtml(value = '') {
  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeSearchText(value = '') {
  return stripHtml(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildBasicAuth(username, password) {
  return Buffer.from(`${username}:${password}`).toString('base64');
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message = data?.message || data?.error || `WordPress API error (${response.status})`;
    throw new Error(message);
  }

  return { data, response };
}

function buildEditUrl(wpUrl, id) {
  return `${stripTrailingSlash(wpUrl)}/wp-admin/post.php?post=${id}&action=edit`;
}

function readWpTitle(item = {}) {
  return stripHtml(item.title?.raw || item.title?.rendered || item.title || '');
}

function readWpContent(item = {}) {
  return String(item.content?.raw || item.content?.rendered || item.content || '');
}

function normalizeStatus(status = 'publish') {
  const value = String(status || 'publish').toLowerCase();
  return WP_POST_STATUSES.has(value) ? value : 'publish';
}

function normalizeMaxItems(value) {
  return Math.min(MAX_ITEMS_LIMIT, Math.max(1, Number(value) || DEFAULT_MAX_ITEMS));
}

function validateWpUrl(wpUrl) {
  const baseUrl = stripTrailingSlash(wpUrl);
  if (!baseUrl) {
    throw new Error('Thiếu URL Website WordPress.');
  }
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error('URL Website WordPress không hợp lệ.');
  }
  return baseUrl;
}

function extractContentH1s(content = '') {
  const html = String(content || '');
  if (!html.trim()) return [];

  const $ = cheerio.load(html, { decodeEntities: true }, false);
  const h1s = [];

  $('h1').each((index, element) => {
    const text = stripHtml($(element).text());
    if (text) {
      h1s.push({
        text,
        source: 'content',
        sourceLabel: `Content H1 ${index + 1}`,
      });
    }
  });

  return h1s;
}

function extractPostH1s(item = {}) {
  const title = readWpTitle(item);
  const entries = [
    ...(title ? [{
      text: title,
      source: 'title',
      sourceLabel: 'Tiêu đề/H1 chính',
    }] : []),
    ...extractContentH1s(readWpContent(item)),
  ];

  const seen = new Set();
  return entries.filter((entry) => {
    const key = normalizeSearchText(entry.text);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const SNIPPET_RADIUS = 60;

function buildBodySnippet(bodyText, phrase, normalizedPhrase) {
  const text = String(bodyText || '');
  if (!text || !normalizedPhrase) return null;

  const lowerIndex = text.toLowerCase().indexOf(phrase.toLowerCase());
  let index = lowerIndex;

  if (index === -1) {
    const normalizedBody = normalizeSearchText(text);
    const normalizedIndex = normalizedBody.indexOf(normalizedPhrase);
    if (normalizedIndex === -1) return null;
    // Accent-insensitive fallback: normalization can change string length,
    // so approximate the original position proportionally.
    index = Math.round((normalizedIndex / Math.max(normalizedBody.length, 1)) * text.length);
  }

  const matchLength = lowerIndex !== -1 ? phrase.length : 1;
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(text.length, index + matchLength + SNIPPET_RADIUS);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';

  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

async function listWpPosts({
  wpUrl,
  wpUsername,
  wpAppPassword,
  maxItems = DEFAULT_MAX_ITEMS,
  status = 'publish',
}) {
  const baseUrl = validateWpUrl(wpUrl);
  const limit = normalizeMaxItems(maxItems);
  const selectedStatus = normalizeStatus(status);
  const hasAuth = Boolean(wpUsername && wpAppPassword);

  if (selectedStatus !== 'publish' && !hasAuth) {
    throw new Error('Cần WordPress Username và Application Password để quét trạng thái này.');
  }

  const headers = hasAuth
    ? { Authorization: `Basic ${buildBasicAuth(wpUsername, wpAppPassword)}` }
    : {};
  const items = [];
  let page = 1;

  while (items.length < limit) {
    const params = new URLSearchParams({
      per_page: '100',
      page: String(page),
      status: selectedStatus,
      orderby: 'modified',
      order: 'desc',
      _fields: 'id,title,link,status,slug,modified,modified_gmt,content',
    });

    if (hasAuth) {
      params.set('context', 'edit');
    }

    const { data, response } = await fetchJson(`${baseUrl}/wp-json/wp/v2/posts?${params.toString()}`, {
      headers,
    });

    if (!Array.isArray(data) || !data.length) break;

    data.forEach((item) => {
      items.push({
        id: item.id,
        title: readWpTitle(item),
        status: item.status,
        slug: item.slug,
        link: item.link,
        editUrl: buildEditUrl(wpUrl, item.id),
        modified: item.modified,
        modifiedGmt: item.modified_gmt,
        h1s: extractPostH1s(item),
        bodyText: stripHtml(readWpContent(item)),
      });
    });

    const totalPages = Number(response.headers.get('x-wp-totalpages')) || page;
    if (page >= totalPages) break;
    page += 1;
  }

  return items.slice(0, limit);
}

export async function searchWpPosts({
  wpUrl,
  wpUsername,
  wpAppPassword,
  phrase = DEFAULT_PHRASE,
  maxItems = DEFAULT_MAX_ITEMS,
  status = 'publish',
}) {
  const cleanPhrase = String(phrase || DEFAULT_PHRASE).trim();
  const normalizedPhrase = normalizeSearchText(cleanPhrase);
  if (!normalizedPhrase) {
    throw new Error('Thiếu cụm từ cần tìm.');
  }

  const selectedStatus = normalizeStatus(status);
  const limit = normalizeMaxItems(maxItems);
  const posts = await listWpPosts({
    wpUrl,
    wpUsername,
    wpAppPassword,
    maxItems: limit,
    status: selectedStatus,
  });

  const results = posts
    .map((post) => {
      const h1Matches = post.h1s.filter((h1) => normalizeSearchText(h1.text).includes(normalizedPhrase));
      const bodySnippet = buildBodySnippet(post.bodyText, cleanPhrase, normalizedPhrase);
      const matches = bodySnippet
        ? [...h1Matches, { text: bodySnippet, source: 'body', sourceLabel: 'Nội dung bài viết' }]
        : h1Matches;
      if (!matches.length) return null;

      const { bodyText, ...postWithoutBody } = post;
      return {
        ...postWithoutBody,
        matches,
        matchedH1: matches[0]?.text || '',
        matchSources: [...new Set(matches.map((match) => match.sourceLabel))],
      };
    })
    .filter(Boolean);

  return {
    phrase: cleanPhrase,
    status: selectedStatus,
    maxItems: limit,
    totalScanned: posts.length,
    matchedCount: results.length,
    titleMatchCount: results.filter((item) => item.matches.some((match) => match.source === 'title')).length,
    contentH1MatchCount: results.filter((item) => item.matches.some((match) => match.source === 'content')).length,
    bodyMatchCount: results.filter((item) => item.matches.some((match) => match.source === 'body')).length,
    results,
  };
}
