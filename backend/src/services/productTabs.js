const DEFAULT_MIN_CONFIDENCE = 0.82;
const USAGE_META_KEY = '_tgg_usage_instructions';
const STORAGE_META_KEY = '_tgg_storage_instructions';
const CUSTOM_TABS_META_KEY = '_tgg_custom_product_tabs';
const MAX_MANUAL_TABS = 8;

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

function hasHtmlTags(value = '') {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
}

function tabInputToHtml(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  return hasHtmlTags(text) ? text : textToTabHtml(text);
}

function normalizeManualTabs(tabs = []) {
  if (!Array.isArray(tabs)) return [];

  return tabs
    .slice(0, MAX_MANUAL_TABS)
    .map((tab, index) => {
      const title = String(tab?.title || '').trim();
      const content = tabInputToHtml(tab?.content || '');

      return {
        title,
        content,
        priority: Number(tab?.priority) || 34 + index,
      };
    })
    .filter((tab) => tab.title && tab.content);
}

function getMetaValue(product, key) {
  const metaData = Array.isArray(product?.meta_data) ? product.meta_data : [];
  return metaData.find((item) => item.key === key)?.value || '';
}

function parseCustomTabs(value = '') {
  if (Array.isArray(value)) return normalizeManualTabs(value);

  try {
    const parsed = JSON.parse(String(value || '[]'));
    return normalizeManualTabs(parsed);
  } catch {
    return [];
  }
}

function titleMatches(title = '', needles = []) {
  const folded = foldText(title);
  return needles.some((needle) => folded.includes(needle));
}

function getLegacyMetaFromTabs(tabs = []) {
  const usageTab = tabs.find((tab) => titleMatches(tab.title, ['huong dan su dung', 'cach su dung', 'su dung']));
  const storageTab = tabs.find((tab) => titleMatches(tab.title, ['huong dan bao quan', 'bao quan']));

  return {
    usageHtml: usageTab?.content || '',
    storageHtml: storageTab?.content || '',
  };
}

function extractProductTabs(product) {
  const customTabs = parseCustomTabs(getMetaValue(product, CUSTOM_TABS_META_KEY));
  const tabs = [...customTabs];
  const hasUsageCustomTab = customTabs.some((tab) => titleMatches(tab.title, ['huong dan su dung', 'cach su dung']));
  const hasStorageCustomTab = customTabs.some((tab) => titleMatches(tab.title, ['huong dan bao quan', 'bao quan']));
  const usageHtml = String(getMetaValue(product, USAGE_META_KEY) || '');
  const storageHtml = String(getMetaValue(product, STORAGE_META_KEY) || '');

  if (usageHtml && !hasUsageCustomTab) {
    tabs.push({
      title: 'Hướng dẫn sử dụng',
      content: usageHtml,
      priority: 35,
      source: 'legacy',
    });
  }

  if (storageHtml && !hasStorageCustomTab) {
    tabs.push({
      title: 'Hướng dẫn bảo quản',
      content: storageHtml,
      priority: 36,
      source: 'legacy',
    });
  }

  return tabs;
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

function buildProductEditUrl(wpUrl, productId) {
  if (!wpUrl || !productId) return '';
  return `${stripTrailingSlash(wpUrl)}/wp-admin/post.php?post=${productId}&action=edit`;
}

function compactProduct(product, wpUrl = '') {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku || '',
    permalink: product.permalink || '',
    editUrl: buildProductEditUrl(wpUrl, product.id),
    status: product.status || '',
    price: product.price || '',
    regularPrice: product.regular_price || '',
    salePrice: product.sale_price || '',
    image: product.images?.[0]?.src || '',
  };
}

function buildWooAuth(consumerKey, consumerSecret) {
  return Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
}

async function wooFetchResponse({ wpUrl, consumerKey, consumerSecret }, path, options = {}) {
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

  return { data, response };
}

async function wooFetch(credentials, path, options = {}) {
  const { data } = await wooFetchResponse(credentials, path, options);
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
      product: compactProduct(product, credentials.wpUrl),
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

export async function listWooProducts({
  wpUrl,
  consumerKey,
  consumerSecret,
  search = '',
  page = 1,
  perPage = 20,
  status = 'any',
}) {
  const credentials = { wpUrl, consumerKey, consumerSecret };
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(perPage) || 20));
  const params = new URLSearchParams({
    page: String(currentPage),
    per_page: String(pageSize),
    status: status || 'any',
  });

  if (String(search || '').trim()) {
    params.set('search', String(search).trim());
  }

  const { data, response } = await wooFetchResponse(credentials, `/products?${params.toString()}`);
  const products = Array.isArray(data) ? data.map((product) => compactProduct(product, wpUrl)) : [];
  const total = Number(response.headers.get('x-wp-total')) || products.length;
  const totalPages = Number(response.headers.get('x-wp-totalpages')) || 1;

  return {
    products,
    page: currentPage,
    perPage: pageSize,
    total,
    totalPages,
  };
}

export async function getWooProductTabs({ wpUrl, consumerKey, consumerSecret, productId }) {
  const credentials = { wpUrl, consumerKey, consumerSecret };
  const product = await wooFetch(credentials, `/products/${encodeURIComponent(productId)}?context=edit`);

  return {
    product: compactProduct(product, wpUrl),
    tabs: extractProductTabs(product),
    metaKeys: {
      customTabs: CUSTOM_TABS_META_KEY,
      usage: USAGE_META_KEY,
      storage: STORAGE_META_KEY,
    },
  };
}

export async function saveWooProductTabs({ wpUrl, consumerKey, consumerSecret, productId, tabs = [] }) {
  const credentials = { wpUrl, consumerKey, consumerSecret };
  const normalizedTabs = normalizeManualTabs(tabs);

  if (!productId) {
    throw new Error('Thiếu productId.');
  }

  if (!normalizedTabs.length) {
    throw new Error('Cần nhập ít nhất 1 tab có tiêu đề và nội dung.');
  }

  const legacyMeta = getLegacyMetaFromTabs(normalizedTabs);

  await wooFetch(credentials, `/products/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      meta_data: [
        { key: CUSTOM_TABS_META_KEY, value: JSON.stringify(normalizedTabs) },
        { key: USAGE_META_KEY, value: legacyMeta.usageHtml },
        { key: STORAGE_META_KEY, value: legacyMeta.storageHtml },
      ],
    }),
  });

  const updatedProduct = await wooFetch(credentials, `/products/${encodeURIComponent(productId)}?context=edit`);
  const savedCustomTabs = parseCustomTabs(getMetaValue(updatedProduct, CUSTOM_TABS_META_KEY));

  return {
    success: true,
    product: compactProduct(updatedProduct, wpUrl),
    tabs: savedCustomTabs,
    savedCount: savedCustomTabs.length,
    verified: JSON.stringify(savedCustomTabs) === JSON.stringify(normalizedTabs),
    metaKeys: {
      customTabs: CUSTOM_TABS_META_KEY,
      usage: USAGE_META_KEY,
      storage: STORAGE_META_KEY,
    },
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

      const updatedProduct = await wooFetch(credentials, `/products/${match.product.id}?context=edit`);
      const metaData = Array.isArray(updatedProduct?.meta_data) ? updatedProduct.meta_data : [];
      const usageValue = metaData.find((item) => item.key === USAGE_META_KEY)?.value || '';
      const storageValue = metaData.find((item) => item.key === STORAGE_META_KEY)?.value || '';
      const usageSaved = String(usageValue) === row.usageHtml;
      const storageSaved = String(storageValue) === row.storageHtml;

      return {
        ...match,
        product: compactProduct(updatedProduct, wpUrl),
        action: 'updated',
        usageUpdated: Boolean(row.usageHtml),
        storageUpdated: Boolean(row.storageHtml),
        usageSaved,
        storageSaved,
        verified: usageSaved && storageSaved,
        savedMetaLengths: {
          usage: String(usageValue).length,
          storage: String(storageValue).length,
        },
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
  const verifiedCount = results.filter((result) => result.action === 'updated' && result.verified).length;
  const skippedCount = results.filter((result) => result.action === 'skipped').length;
  const errorCount = results.filter((result) => result.action === 'error').length;

  return {
    totalRows: rows.length,
    updatedCount,
    verifiedCount,
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

export function validateWooCredentials({ wpUrl, consumerKey, consumerSecret }) {
  if (!wpUrl || !consumerKey || !consumerSecret) {
    throw new Error('Thiếu URL WordPress hoặc Woo Consumer Key/Secret.');
  }
}

export function validateProductTabCredentials({ wpUrl, consumerKey, consumerSecret, sheetUrl }) {
  validateWooCredentials({ wpUrl, consumerKey, consumerSecret });

  if (!sheetUrl) {
    throw new Error('Thiếu Google Sheet URL.');
  }
}
