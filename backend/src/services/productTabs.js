const DEFAULT_MIN_CONFIDENCE = 0.82;
const USAGE_META_KEY = '_tgg_usage_instructions';
const STORAGE_META_KEY = '_tgg_storage_instructions';

function stripTrailingSlash(value = '') {
  return String(value || '').replace(/\/+$/, '');
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function foldText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function normalizeProductName(value = '') {
  return foldText(value)
    .replace(/&amp;/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value = '') {
  return normalizeProductName(value).replace(/\s+/g, '-');
}

function tokenSet(value = '') {
  return new Set(normalizeProductName(value).split(' ').filter(Boolean));
}

function parseCsv(csvText = '') {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((items) => items.some((item) => String(item || '').trim()));
}

function findHeaderIndex(rows) {
  return rows.findIndex((row) => {
    const folded = row.map(foldText);
    return folded.some((cell) => cell.includes('ten san pham'))
      && folded.some((cell) => cell.includes('huong dan su dung'))
      && folded.some((cell) => cell.includes('huong dan bao quan'));
  });
}

function findColumn(headers, candidates) {
  const foldedHeaders = headers.map(foldText);
  return foldedHeaders.findIndex((header) => candidates.some((candidate) => header.includes(candidate)));
}

function textToTabHtml(value = '') {
  const lines = String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return '';

  const blocks = [];
  let listItems = [];

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<ul>${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
    listItems = [];
  };

  lines.forEach((line) => {
    const bulletMatch = line.match(/^(?:[•\-*+]|–)\s*(.+)$/);
    if (bulletMatch) {
      listItems.push(bulletMatch[1].trim());
      return;
    }

    flushList();
    blocks.push(`<p>${escapeHtml(line)}</p>`);
  });

  flushList();
  return blocks.join('\n');
}

function extractRowsFromCsv(csvText) {
  const rows = parseCsv(csvText);
  const headerIndex = findHeaderIndex(rows);

  if (headerIndex < 0) {
    throw new Error('Không tìm thấy cột Tên sản phẩm, Hướng dẫn sử dụng, Hướng dẫn bảo quản trong sheet.');
  }

  const headers = rows[headerIndex];
  const nameColumn = findColumn(headers, ['ten san pham', 'product name', 'name']);
  const usageColumn = findColumn(headers, ['huong dan su dung', 'usage', 'use instructions']);
  const storageColumn = findColumn(headers, ['huong dan bao quan', 'bao quan', 'storage']);
  const sttColumn = findColumn(headers, ['stt', 'no', 'index']);

  if (nameColumn < 0 || usageColumn < 0 || storageColumn < 0) {
    throw new Error('Sheet thiếu một trong các cột bắt buộc: Tên sản phẩm, Hướng dẫn sử dụng, Hướng dẫn bảo quản.');
  }

  return rows
    .slice(headerIndex + 1)
    .map((row, index) => {
      const productName = String(row[nameColumn] || '').trim();
      const usageText = String(row[usageColumn] || '').trim();
      const storageText = String(row[storageColumn] || '').trim();
      const sheetIndex = sttColumn >= 0 ? String(row[sttColumn] || '').trim() : String(index + 1);

      return {
        rowNumber: headerIndex + index + 2,
        sheetIndex,
        productName,
        usageText,
        storageText,
        usageHtml: textToTabHtml(usageText),
        storageHtml: textToTabHtml(storageText),
      };
    })
    .filter((row) => row.productName && (row.usageText || row.storageText));
}

function parseSheetUrl(sheetUrl = '') {
  const value = String(sheetUrl || '').trim();
  if (!value) throw new Error('sheetUrl is required');

  if (/^https?:\/\/.+\/export\?/i.test(value) || /output=csv/i.test(value)) {
    return { csvUrl: value };
  }

  const idMatch = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) throw new Error('Google Sheet URL không hợp lệ.');

  let gid = '0';

  try {
    const parsed = new URL(value);
    gid = parsed.searchParams.get('gid') || gid;
    if (parsed.hash) {
      const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
      gid = hashParams.get('gid') || gid;
    }
  } catch {}

  return {
    spreadsheetId: idMatch[1],
    gid,
    csvUrl: `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`,
  };
}

async function fetchTextWithTimeout(url, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Không đọc được Google Sheet (${response.status}).`);
    }

    if (/^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text)) {
      throw new Error('Google Sheet chưa public hoặc không export được CSV.');
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadProductTabRows(sheetUrl) {
  const source = parseSheetUrl(sheetUrl);
  const csvText = await fetchTextWithTimeout(source.csvUrl);
  const rows = extractRowsFromCsv(csvText);

  return {
    source,
    rows,
  };
}

function extractPossibleSkus(name = '') {
  const matches = String(name || '').match(/[A-Z0-9]{2,}(?:[-_/][A-Z0-9]+)+/gi) || [];
  return [...new Set(matches.map((item) => item.trim()).filter(Boolean))];
}

function scoreCandidate(sourceRow, candidate) {
  const sourceName = normalizeProductName(sourceRow.productName);
  const candidateName = normalizeProductName(candidate.name);
  const sourceSlug = slugify(sourceRow.productName);
  const candidateSlug = String(candidate.slug || '').trim().toLowerCase();
  const possibleSkus = extractPossibleSkus(sourceRow.productName).map((sku) => sku.toLowerCase());
  const candidateSku = String(candidate.sku || '').trim().toLowerCase();

  if (candidateSku && possibleSkus.includes(candidateSku)) return 1;
  if (sourceName && candidateName && sourceName === candidateName) return 1;
  if (sourceSlug && candidateSlug && sourceSlug === candidateSlug) return 0.97;

  let containsScore = 0;
  if (sourceName && candidateName && (sourceName.includes(candidateName) || candidateName.includes(sourceName))) {
    const smallerLength = Math.min(sourceName.length, candidateName.length);
    const largerLength = Math.max(sourceName.length, candidateName.length);
    containsScore = Math.max(0.78, smallerLength / largerLength);
  }

  const sourceTokens = tokenSet(sourceRow.productName);
  const candidateTokens = tokenSet(candidate.name);
  const shared = [...sourceTokens].filter((token) => candidateTokens.has(token)).length;
  const tokenScore = sourceTokens.size && candidateTokens.size
    ? (2 * shared) / (sourceTokens.size + candidateTokens.size)
    : 0;

  return Math.max(containsScore, tokenScore);
}

function compactProduct(product) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku || '',
    permalink: product.permalink || '',
  };
}

function buildWooAuth(consumerKey, consumerSecret) {
  return Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
}

async function wooFetch({ wpUrl, consumerKey, consumerSecret }, path, options = {}) {
  const baseUrl = stripTrailingSlash(wpUrl);
  const response = await fetch(`${baseUrl}/wp-json/wc/v3${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${buildWooAuth(consumerKey, consumerSecret)}`,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message = data?.message || data?.error || `WooCommerce API error (${response.status})`;
    throw new Error(message);
  }

  return data;
}

async function searchProducts(credentials, row) {
  const queries = [];
  const possibleSkus = extractPossibleSkus(row.productName);
  possibleSkus.forEach((sku) => {
    queries.push(`/products?sku=${encodeURIComponent(sku)}&per_page=20&status=any`);
  });

  const slug = slugify(row.productName);
  if (slug) {
    queries.push(`/products?slug=${encodeURIComponent(slug)}&per_page=20&status=any`);
  }

  queries.push(`/products?search=${encodeURIComponent(row.productName)}&per_page=20&status=any`);

  const productsById = new Map();

  for (const query of queries) {
    const products = await wooFetch(credentials, query);
    if (Array.isArray(products)) {
      products.forEach((product) => productsById.set(product.id, product));
    }
    if (productsById.size >= 20) break;
  }

  return [...productsById.values()];
}

export async function findProductMatch(credentials, row, minConfidence = DEFAULT_MIN_CONFIDENCE) {
  const candidates = await searchProducts(credentials, row);
  const scoredCandidates = candidates
    .map((product) => ({
      product: compactProduct(product),
      confidence: Number(scoreCandidate(row, product).toFixed(3)),
    }))
    .sort((a, b) => b.confidence - a.confidence);

  const best = scoredCandidates[0] || null;
  const matched = Boolean(best && best.confidence >= minConfidence);

  return {
    rowNumber: row.rowNumber,
    sheetIndex: row.sheetIndex,
    productName: row.productName,
    matched,
    confidence: best?.confidence || 0,
    matchType: !best ? 'none' : best.confidence >= 0.96 ? 'exact' : best.confidence >= minConfidence ? 'high' : 'low',
    product: matched ? best.product : null,
    bestCandidate: best?.product || null,
    candidates: scoredCandidates.slice(0, 3),
  };
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

export async function previewProductTabSync({ wpUrl, consumerKey, consumerSecret, sheetUrl, minConfidence = DEFAULT_MIN_CONFIDENCE }) {
  const { source, rows } = await loadProductTabRows(sheetUrl);
  const credentials = { wpUrl, consumerKey, consumerSecret };
  const confidence = Number(minConfidence) || DEFAULT_MIN_CONFIDENCE;

  const matches = await mapWithConcurrency(rows, 4, async (row) => {
    try {
      return await findProductMatch(credentials, row, confidence);
    } catch (error) {
      return {
        rowNumber: row.rowNumber,
        sheetIndex: row.sheetIndex,
        productName: row.productName,
        matched: false,
        confidence: 0,
        matchType: 'error',
        product: null,
        bestCandidate: null,
        candidates: [],
        error: error.message,
      };
    }
  });

  const matchedCount = matches.filter((match) => match.matched).length;
  const lowConfidenceCount = matches.filter((match) => match.matchType === 'low').length;
  const notFoundCount = matches.filter((match) => match.matchType === 'none').length;
  const errorCount = matches.filter((match) => match.matchType === 'error').length;

  return {
    source,
    minConfidence: confidence,
    totalRows: rows.length,
    matchedCount,
    skippedCount: rows.length - matchedCount,
    lowConfidenceCount,
    notFoundCount,
    errorCount,
    metaKeys: {
      usage: USAGE_META_KEY,
      storage: STORAGE_META_KEY,
    },
    matches,
  };
}

export async function syncProductTabs({ wpUrl, consumerKey, consumerSecret, sheetUrl, minConfidence = DEFAULT_MIN_CONFIDENCE }) {
  const { rows } = await loadProductTabRows(sheetUrl);
  const credentials = { wpUrl, consumerKey, consumerSecret };
  const confidence = Number(minConfidence) || DEFAULT_MIN_CONFIDENCE;
  const touchedProducts = new Set();

  const results = await mapWithConcurrency(rows, 3, async (row) => {
    try {
      const match = await findProductMatch(credentials, row, confidence);

      if (!match.matched) {
        return {
          ...match,
          action: 'skipped',
          reason: match.bestCandidate ? 'low-confidence' : 'not-found',
        };
      }

      if (touchedProducts.has(match.product.id)) {
        return {
          ...match,
          action: 'skipped',
          reason: 'duplicate-product',
        };
      }

      touchedProducts.add(match.product.id);

      await wooFetch(credentials, `/products/${match.product.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          meta_data: [
            { key: USAGE_META_KEY, value: row.usageHtml },
            { key: STORAGE_META_KEY, value: row.storageHtml },
          ],
        }),
      });

      return {
        ...match,
        action: 'updated',
        usageUpdated: Boolean(row.usageHtml),
        storageUpdated: Boolean(row.storageHtml),
      };
    } catch (error) {
      return {
        rowNumber: row.rowNumber,
        sheetIndex: row.sheetIndex,
        productName: row.productName,
        matched: false,
        confidence: 0,
        matchType: 'error',
        product: null,
        bestCandidate: null,
        candidates: [],
        action: 'error',
        error: error.message,
      };
    }
  });

  const updatedCount = results.filter((result) => result.action === 'updated').length;
  const skippedCount = results.filter((result) => result.action === 'skipped').length;
  const errorCount = results.filter((result) => result.action === 'error').length;

  return {
    totalRows: rows.length,
    updatedCount,
    skippedCount,
    errorCount,
    minConfidence: confidence,
    metaKeys: {
      usage: USAGE_META_KEY,
      storage: STORAGE_META_KEY,
    },
    results,
  };
}

export function validateProductTabCredentials({ wpUrl, consumerKey, consumerSecret, sheetUrl }) {
  if (!wpUrl || !consumerKey || !consumerSecret || !sheetUrl) {
    throw new Error('Thiếu URL WordPress, Woo Consumer Key/Secret hoặc Google Sheet URL.');
  }
}
