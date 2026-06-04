import { google } from 'googleapis';

const DEFAULT_MIN_CONFIDENCE = 0.82;
const USAGE_META_KEY = '_tgg_usage_instructions';
const STORAGE_META_KEY = '_tgg_storage_instructions';
const CUSTOM_TABS_META_KEY = '_tgg_custom_product_tabs';
const BARN2_FIELD_PREFIX = '_wpt_field_';
const BARN2_OVERRIDE_PREFIX = '_wpt_override_';
const DEFAULT_BARN2_USAGE_TAB_KEY = 'wpt-38110';
const DEFAULT_BARN2_STORAGE_TAB_KEY = 'wpt-38106';
const MAX_MANUAL_TABS = 8;
const SYNC_TARGETS = new Set(['both', 'usage', 'storage']);

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
  return decodeHtmlEntities(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeBarn2TabKey(value = '') {
  return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
}

function resolveBarn2TabKeys(tabKeys = {}) {
  return {
    usage: normalizeBarn2TabKey(
      tabKeys.usage
        || tabKeys.usageTabKey
        || tabKeys.barn2UsageTabKey
        || process.env.BARN2_USAGE_TAB_KEY
        || DEFAULT_BARN2_USAGE_TAB_KEY
    ),
    storage: normalizeBarn2TabKey(
      tabKeys.storage
        || tabKeys.storageTabKey
        || tabKeys.barn2StorageTabKey
        || process.env.BARN2_STORAGE_TAB_KEY
        || DEFAULT_BARN2_STORAGE_TAB_KEY
    ),
  };
}

function buildConfiguredBarn2Tabs(tabKeys = {}) {
  const resolved = resolveBarn2TabKeys(tabKeys);
  const tabs = [];

  if (resolved.usage) {
    tabs.push({
      id: null,
      slug: resolved.usage,
      title: 'Hướng dẫn sử dụng',
      content: '',
      priority: 12,
      status: 'configured',
    });
  }

  if (resolved.storage) {
    tabs.push({
      id: null,
      slug: resolved.storage,
      title: 'Hướng dẫn bảo quản',
      content: '',
      priority: 13,
      status: 'configured',
    });
  }

  return tabs;
}

function normalizeSyncTarget(value = 'both') {
  const target = String(value || 'both').trim().toLowerCase();
  return SYNC_TARGETS.has(target) ? target : 'both';
}

function shouldSyncUsage(target = 'both') {
  return target === 'both' || target === 'usage';
}

function shouldSyncStorage(target = 'both') {
  return target === 'both' || target === 'storage';
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

function uniqueStrings(items = []) {
  const seen = new Set();
  const values = [];

  items.forEach((item) => {
    const value = String(item || '').trim();
    const key = foldText(value);
    if (!value || seen.has(key)) return;
    seen.add(key);
    values.push(value);
  });

  return values;
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

function findColumn(headers, candidates, { allowLooseMatch = true } = {}) {
  const foldedHeaders = headers.map(foldText);
  const exactIndex = foldedHeaders.findIndex((header) => candidates.some((candidate) => header === candidate));
  if (exactIndex >= 0) return exactIndex;

  const startsWithIndex = foldedHeaders.findIndex((header) => candidates.some((candidate) => header.startsWith(candidate)));
  if (startsWithIndex >= 0) return startsWithIndex;

  if (!allowLooseMatch) return -1;

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

function getMetaEntries(product, key) {
  const metaData = Array.isArray(product?.meta_data) ? product.meta_data : [];
  return metaData.filter((item) => item?.key === key);
}

function getMetaValue(product, key) {
  const entries = getMetaEntries(product, key);
  return entries.length ? entries[entries.length - 1]?.value || '' : '';
}

function buildMetaUpdateItems(product, items = []) {
  const desiredByKey = new Map();
  const orderedKeys = [];

  items.forEach((item) => {
    if (!item?.key) return;

    if (!desiredByKey.has(item.key)) {
      orderedKeys.push(item.key);
    }

    desiredByKey.set(item.key, item.value ?? '');
  });

  return orderedKeys.flatMap((key) => {
    const value = desiredByKey.get(key);
    const existingEntries = getMetaEntries(product, key).filter((entry) => entry?.id !== undefined && entry?.id !== null);

    if (!existingEntries.length) {
      return [{ key, value }];
    }

    return existingEntries.map((entry) => ({
      id: entry.id,
      key,
      value,
    }));
  });
}

function isMetaValueSaved(product, key, expectedValue = '') {
  const entries = getMetaEntries(product, key);
  const expected = String(expectedValue || '');

  if (!entries.length) {
    return expected === '';
  }

  return entries.every((entry) => String(entry?.value || '') === expected);
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

function titleSimilarity(left = '', right = '') {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;

  return leftTokens.size && rightTokens.size
    ? (2 * shared) / (leftTokens.size + rightTokens.size)
    : 0;
}

function getTabAliasNeedles(title = '') {
  if (titleMatches(title, ['huong dan su dung', 'cach su dung', 'su dung'])) {
    return ['huong dan su dung', 'cach su dung'];
  }

  if (titleMatches(title, ['huong dan bao quan', 'bao quan'])) {
    return ['huong dan bao quan', 'bao quan'];
  }

  return [foldText(title)];
}

function getLegacyMetaFromTabs(tabs = []) {
  const usageTab = tabs.find((tab) => titleMatches(tab.title, ['huong dan su dung', 'cach su dung', 'su dung']));
  const storageTab = tabs.find((tab) => titleMatches(tab.title, ['huong dan bao quan', 'bao quan']));

  return {
    usageHtml: usageTab?.content || '',
    storageHtml: storageTab?.content || '',
  };
}

function findBarn2TabForTitle(tabs = [], title = '') {
  const foldedTitle = foldText(title);
  const aliases = getTabAliasNeedles(title);

  return tabs.find((tab) => foldText(tab.title) === foldedTitle)
    || tabs.find((tab) => aliases.some((alias) => titleMatches(tab.title, [alias])))
    || tabs
      .map((tab) => ({ tab, score: titleSimilarity(tab.title, title) }))
      .filter(({ score }) => score >= 0.66)
      .sort((a, b) => b.score - a.score)[0]?.tab
    || null;
}

function buildBarn2MetaForTabs(tabs = [], barn2Tabs = []) {
  const usedSlugs = new Set();
  const mappings = [];
  const metaData = [];

  for (const tab of tabs) {
    const barn2Tab = findBarn2TabForTitle(
      barn2Tabs.filter((item) => !usedSlugs.has(item.slug)),
      tab.title
    );

    if (!barn2Tab?.slug) continue;

    usedSlugs.add(barn2Tab.slug);
    mappings.push({
      title: tab.title,
      barn2Title: barn2Tab.title,
      slug: barn2Tab.slug,
      fieldKey: `${BARN2_FIELD_PREFIX}${barn2Tab.slug}`,
      overrideKey: `${BARN2_OVERRIDE_PREFIX}${barn2Tab.slug}`,
    });

    metaData.push(
      { key: `${BARN2_OVERRIDE_PREFIX}${barn2Tab.slug}`, value: 'yes' },
      { key: `${BARN2_FIELD_PREFIX}${barn2Tab.slug}`, value: tab.content }
    );
  }

  return { mappings, metaData };
}

function verifyBarn2Mappings(product, mappings = [], sourceTabs = []) {
  if (!mappings.length) {
    return {
      matchedCount: 0,
      verified: false,
      mappings: [],
    };
  }

  const verifiedMappings = mappings.map((mapping) => {
    const source = sourceTabs.find((tab) => tab.title === mapping.title) || {};
    const fieldValue = getMetaValue(product, mapping.fieldKey);
    const fieldEntries = getMetaEntries(product, mapping.fieldKey);
    const overrideEntries = getMetaEntries(product, mapping.overrideKey);

    return {
      ...mapping,
      fieldSaved: isMetaValueSaved(product, mapping.fieldKey, source.content || ''),
      overrideSaved: isMetaValueSaved(product, mapping.overrideKey, 'yes'),
      savedLength: String(fieldValue || '').length,
      metaCount: fieldEntries.length,
      overrideMetaCount: overrideEntries.length,
    };
  });

  return {
    matchedCount: verifiedMappings.length,
    verified: verifiedMappings.every((mapping) => mapping.fieldSaved && mapping.overrideSaved),
    mappings: verifiedMappings,
  };
}

function getPreferredLegacyContentForBarn2Tab(tab, product) {
  if (titleMatches(tab.title, ['huong dan su dung', 'cach su dung', 'su dung'])) {
    return String(getMetaValue(product, USAGE_META_KEY) || '');
  }

  if (titleMatches(tab.title, ['huong dan bao quan', 'bao quan'])) {
    return String(getMetaValue(product, STORAGE_META_KEY) || '');
  }

  return '';
}

function buildBarn2ProductTabs(product, barn2Tabs = []) {
  return barn2Tabs.map((tab, index) => {
    const fieldKey = `${BARN2_FIELD_PREFIX}${tab.slug}`;
    const overrideKey = `${BARN2_OVERRIDE_PREFIX}${tab.slug}`;
    const fieldContent = String(getMetaValue(product, fieldKey) || '');
    const overrideValue = String(getMetaValue(product, overrideKey) || '');
    const legacyContent = getPreferredLegacyContentForBarn2Tab(tab, product);

    return {
      title: tab.title,
      content: fieldContent || legacyContent || tab.content || '',
      priority: Number(tab.priority) || 34 + index,
      source: fieldContent ? 'barn2-product' : legacyContent ? 'legacy' : 'barn2-global',
      barn2Slug: tab.slug,
      barn2FieldKey: fieldKey,
      barn2OverrideKey: overrideKey,
      barn2Overridden: overrideValue === 'yes' || Boolean(fieldContent),
    };
  }).filter((tab) => tab.title);
}

function mergeProductTabs(product, barn2Tabs = []) {
  const tabs = buildBarn2ProductTabs(product, barn2Tabs);
  const customTabs = parseCustomTabs(getMetaValue(product, CUSTOM_TABS_META_KEY));

  customTabs.forEach((tab) => {
    if (!tabs.some((existing) => titleSimilarity(existing.title, tab.title) >= 0.8)) {
      tabs.push(tab);
    }
  });

  const hasUsageTab = tabs.some((tab) => titleMatches(tab.title, ['huong dan su dung', 'cach su dung']));
  const hasStorageTab = tabs.some((tab) => titleMatches(tab.title, ['huong dan bao quan', 'bao quan']));
  const usageHtml = String(getMetaValue(product, USAGE_META_KEY) || '');
  const storageHtml = String(getMetaValue(product, STORAGE_META_KEY) || '');

  if (usageHtml && !hasUsageTab) {
    tabs.push({
      title: 'Hướng dẫn sử dụng',
      content: usageHtml,
      priority: 35,
      source: 'legacy',
    });
  }

  if (storageHtml && !hasStorageTab) {
    tabs.push({
      title: 'Hướng dẫn bảo quản',
      content: storageHtml,
      priority: 36,
      source: 'legacy',
    });
  }

  return tabs.filter((tab) => tab.title);
}

function compactBarn2Tab(tab = {}) {
  const slug = String(tab.slug || tab.post_name || (tab.id ? `wpt-${tab.id}` : '')).trim();
  const title = stripHtml(tab.title?.raw || tab.title?.rendered || tab.title || '');
  const content = String(tab.content?.raw || tab.content?.rendered || tab.content || '').trim();

  if (!slug || !title) return null;

  return {
    id: tab.id || null,
    slug,
    title,
    content,
    priority: Number(tab.menu_order || tab.order || tab.priority) || 0,
    status: tab.status || '',
  };
}

function extractRowsFromCsv(csvText, sheetMeta = {}) {
  const rows = parseCsv(csvText);
  const headerIndex = findHeaderIndex(rows);

  if (headerIndex < 0) {
    throw new Error('Không tìm thấy cột Tên sản phẩm, Hướng dẫn sử dụng, Hướng dẫn bảo quản trong sheet.');
  }

  const headers = rows[headerIndex];
  const nameColumn = findColumn(headers, ['ten san pham', 'product name', 'name']);
  const usageColumn = findColumn(headers, ['huong dan su dung', 'usage', 'use instructions']);
  const storageColumn = findColumn(headers, ['huong dan bao quan', 'bao quan', 'storage'], { allowLooseMatch: false });
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
        headerRowNumber: headerIndex + 1,
        sheetIndex,
        sheetName: sheetMeta.name || '',
        sheetGid: sheetMeta.gid || '',
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
    editUrl: `https://docs.google.com/spreadsheets/d/${idMatch[1]}/edit?gid=${gid}`,
    csvUrl: `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`,
  };
}

async function fetchTextWithTimeout(url, timeoutMs = 30000, { allowHtml = false } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Không đọc được Google Sheet (${response.status}).`);
    }

    if (!allowHtml && (/^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text))) {
      throw new Error('Google Sheet chưa public hoặc không export được CSV.');
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtml(value = '') {
  return decodeHtmlEntities(String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16))));
}

function parseSheetNamesFromHtml(html = '') {
  const names = [];
  const seen = new Set();
  const regex = /docs-sheet-tab-caption[^>]*>([\s\S]*?)<\/div>/gi;
  let match;

  while ((match = regex.exec(html))) {
    const name = decodeHtml(stripHtml(match[1])).trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }

  return names;
}

function buildSheetCsvUrl(source, sheetName) {
  const params = new URLSearchParams({
    tqx: 'out:csv',
    sheet: sheetName,
  });

  return `https://docs.google.com/spreadsheets/d/${source.spreadsheetId}/gviz/tq?${params.toString()}`;
}

async function discoverSpreadsheetSheets(source) {
  if (!source.spreadsheetId) return [];

  try {
    const html = await fetchTextWithTimeout(source.editUrl, 30000, { allowHtml: true });
    return parseSheetNamesFromHtml(html).map((name) => ({
      name,
      csvUrl: buildSheetCsvUrl(source, name),
    }));
  } catch {
    return [];
  }
}

async function loadRowsFromSheetSource(sheetSource) {
  const csvText = await fetchTextWithTimeout(sheetSource.csvUrl);
  return extractRowsFromCsv(csvText, sheetSource);
}

export async function loadProductTabRows(sheetUrl, { scanAllSheets = false } = {}) {
  const source = parseSheetUrl(sheetUrl);
  const discoveredSheets = scanAllSheets ? await discoverSpreadsheetSheets(source) : [];
  const sheets = discoveredSheets.length
    ? discoveredSheets
    : [{ name: source.gid ? `gid:${source.gid}` : 'Sheet', gid: source.gid, csvUrl: source.csvUrl }];

  const sheetResults = [];
  const rows = [];

  for (const sheet of sheets) {
    try {
      const sheetRows = await loadRowsFromSheetSource(sheet);
      sheetResults.push({
        name: sheet.name,
        gid: sheet.gid || '',
        rowCount: sheetRows.length,
        status: 'loaded',
      });
      rows.push(...sheetRows);
    } catch (error) {
      sheetResults.push({
        name: sheet.name,
        gid: sheet.gid || '',
        rowCount: 0,
        status: 'skipped',
        error: error.message,
      });
    }
  }

  if (!rows.length) {
    const errors = sheetResults
      .filter((sheet) => sheet.error)
      .slice(0, 5)
      .map((sheet) => `${sheet.name}: ${sheet.error}`)
      .join('; ');
    throw new Error(errors || 'Không tìm thấy dòng sản phẩm trong Google Sheet.');
  }

  return {
    source: {
      ...source,
      scanAllSheets: Boolean(scanAllSheets),
      sheetCount: sheetResults.filter((sheet) => sheet.status === 'loaded').length,
      sheets: sheetResults,
    },
    rows,
  };
}

function normalizeSku(value = '') {
  return foldText(value).replace(/[^a-z0-9]/g, '');
}

function extractPossibleSkus(name = '') {
  const text = String(name || '');
  const matches = [];
  const skuRegex = /(?:^|[^a-zA-Z0-9])([a-zA-Z]{1,10}\d{1,8}(?:[-_/]?[a-zA-Z0-9]{1,8})*)/g;
  let match;

  while ((match = skuRegex.exec(text))) {
    const code = String(match[1] || '').replace(/[),.;:\]]+$/g, '').trim();
    if (normalizeSku(code).length >= 3) {
      matches.push(code);
    }
  }

  return uniqueStrings(matches);
}

function buildSkuVariants(skus = []) {
  const variants = [];

  skus.forEach((sku) => {
    const value = String(sku || '').trim();
    if (!value) return;

    variants.push(value, value.toUpperCase(), value.toLowerCase());

    const compact = value.replace(/[-_/\s]+/g, '');
    if (compact !== value) {
      variants.push(compact, compact.toUpperCase(), compact.toLowerCase());
    }

    const spaced = value.replace(/[-_/]+/g, ' ');
    if (spaced !== value) {
      variants.push(spaced);
    }

    const family = value.split(/[-_/]/)[0];
    if (family && family !== value && normalizeSku(family).length >= 3) {
      variants.push(family);
    }
  });

  return uniqueStrings(variants);
}

function stripSkuCodes(value = '') {
  let text = String(value || '');
  const skus = extractPossibleSkus(text);

  skus.forEach((sku) => {
    const escaped = sku.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text
      .replace(new RegExp(`\\s*[\\(|\\[|\\{|\\-|–|—|\\|]*\\s*${escaped}\\s*[\\)|\\]|\\}]*`, 'gi'), ' ')
      .replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ');
  });

  return text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreCandidate(sourceRow, candidate) {
  const sourceName = normalizeProductName(sourceRow.productName);
  const sourceBaseName = normalizeProductName(stripSkuCodes(sourceRow.productName));
  const candidateName = normalizeProductName(candidate.name);
  const candidateBaseName = normalizeProductName(stripSkuCodes(candidate.name));
  const sourceSlug = slugify(sourceRow.productName);
  const sourceBaseSlug = slugify(stripSkuCodes(sourceRow.productName));
  const candidateSlug = String(candidate.slug || '').trim().toLowerCase();
  const possibleSkuKeys = extractPossibleSkus(sourceRow.productName).map(normalizeSku).filter(Boolean);
  const candidateSkuKey = normalizeSku(candidate.sku || '');
  const candidateNameSkuKey = normalizeSku(candidate.name || '');
  const candidateSlugSkuKey = normalizeSku(candidate.slug || '');
  const candidateExplicitSkuKeys = uniqueStrings([
    candidate.sku || '',
    ...extractPossibleSkus(candidate.name || ''),
  ]).map(normalizeSku).filter(Boolean);

  if (candidateSkuKey && possibleSkuKeys.includes(candidateSkuKey)) return 1;

  if (possibleSkuKeys.some((sku) => (
    sku.length >= 3
      && (
        (candidateNameSkuKey && candidateNameSkuKey.includes(sku))
        || (candidateSlugSkuKey && candidateSlugSkuKey.includes(sku))
        || (candidateSkuKey && (candidateSkuKey.includes(sku) || sku.includes(candidateSkuKey)))
      )
  ))) {
    return 1;
  }

  const hasConflictingSku = possibleSkuKeys.length > 0
    && candidateExplicitSkuKeys.length > 0
    && !possibleSkuKeys.some((sourceSku) => candidateExplicitSkuKeys.some((candidateSku) => (
      sourceSku === candidateSku || sourceSku.includes(candidateSku) || candidateSku.includes(sourceSku)
    )));

  if (sourceName && candidateName && sourceName === candidateName) return 1;
  if (sourceSlug && candidateSlug && sourceSlug === candidateSlug) return 0.97;
  if (sourceBaseName && candidateBaseName && sourceBaseName === candidateBaseName) return 0.96;
  if (sourceBaseSlug && candidateSlug && sourceBaseSlug === candidateSlug) return 0.95;

  let containsScore = 0;
  if (sourceName && candidateName && (sourceName.includes(candidateName) || candidateName.includes(sourceName))) {
    const smallerLength = Math.min(sourceName.length, candidateName.length);
    const largerLength = Math.max(sourceName.length, candidateName.length);
    containsScore = Math.max(0.78, smallerLength / largerLength);
  }

  let baseContainsScore = 0;
  if (sourceBaseName && candidateBaseName && (sourceBaseName.includes(candidateBaseName) || candidateBaseName.includes(sourceBaseName))) {
    const smallerLength = Math.min(sourceBaseName.length, candidateBaseName.length);
    const largerLength = Math.max(sourceBaseName.length, candidateBaseName.length);
    baseContainsScore = Math.max(0.8, smallerLength / largerLength);
  }

  const sourceTokens = tokenSet(stripSkuCodes(sourceRow.productName) || sourceRow.productName);
  const candidateTokens = tokenSet(stripSkuCodes(candidate.name) || candidate.name);
  const shared = [...sourceTokens].filter((token) => candidateTokens.has(token)).length;
  const tokenScore = sourceTokens.size && candidateTokens.size
    ? (2 * shared) / (sourceTokens.size + candidateTokens.size)
    : 0;

  const score = Math.max(containsScore, baseContainsScore, tokenScore);
  return hasConflictingSku ? Math.min(score, 0.72) : score;
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

async function wpFetchResponse({ wpUrl, consumerKey, consumerSecret }, path, options = {}) {
  const baseUrl = stripTrailingSlash(wpUrl);
  const headers = {
    'Content-Type': 'application/json',
    ...(options.auth === false ? {} : { Authorization: `Basic ${buildWooAuth(consumerKey, consumerSecret)}` }),
    ...(options.headers || {}),
  };
  delete options.auth;

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

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

async function wpFetch(credentials, path, options = {}) {
  const { data } = await wpFetchResponse(credentials, path, options);
  return data;
}

async function fetchBarn2TabsAttempt(credentials, { auth = true, context = 'view', status = 'publish' } = {}) {
  const params = new URLSearchParams({
    per_page: '100',
    status,
    _fields: 'id,slug,title,content,menu_order,status',
  });

  if (context) params.set('context', context);

  const data = await wpFetch(credentials, `/wp-json/wp/v2/woo_product_tab?${params.toString()}`, { auth });
  const tabs = Array.isArray(data) ? data.map(compactBarn2Tab).filter(Boolean) : [];
  return tabs.sort((a, b) => (a.priority || 0) - (b.priority || 0));
}

async function loadBarn2GlobalTabs(credentials, tabKeys = {}) {
  const configuredTabs = buildConfiguredBarn2Tabs(tabKeys);

  if (configuredTabs.length) {
    return {
      available: true,
      tabs: configuredTabs,
      auth: false,
      context: 'configured',
      warning: '',
    };
  }

  const attempts = [
    { auth: true, context: 'edit', status: 'any' },
    { auth: true, context: 'view', status: 'publish' },
    { auth: false, context: 'view', status: 'publish' },
  ];
  let lastError = null;

  for (const attempt of attempts) {
    try {
      const tabs = await fetchBarn2TabsAttempt(credentials, attempt);
      if (tabs.length) {
        const tabsBySlug = new Map(tabs.map((tab) => [tab.slug, tab]));
        configuredTabs.forEach((tab) => {
          if (!tabsBySlug.has(tab.slug)) {
            tabsBySlug.set(tab.slug, tab);
          }
        });

        return {
          available: true,
          tabs: [...tabsBySlug.values()],
          auth: attempt.auth,
          context: attempt.context,
          warning: '',
        };
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (configuredTabs.length) {
    return {
      available: true,
      tabs: configuredTabs,
      auth: false,
      context: 'configured',
      warning: '',
    };
  }

  return {
    available: false,
    tabs: [],
    auth: false,
    context: '',
    warning: lastError
      ? `Không đọc được Barn2 Product Tabs qua WP REST: ${lastError.message}`
      : 'Không tìm thấy Barn2 Product Tabs trên WordPress.',
  };
}

async function searchProducts(credentials, row) {
  const queries = [];
  const possibleSkus = extractPossibleSkus(row.productName);
  const skuVariants = buildSkuVariants(possibleSkus);
  const cleanName = stripSkuCodes(row.productName);
  const searchTerms = uniqueStrings([
    ...skuVariants,
    row.productName,
    cleanName,
  ]).filter((term) => normalizeProductName(term).length >= 3);

  const addProductQuery = (params) => {
    const query = new URLSearchParams({
      per_page: '100',
      status: 'any',
      ...params,
    });
    const path = `/products?${query.toString()}`;
    if (!queries.includes(path)) queries.push(path);
  };

  skuVariants.forEach((sku) => {
    addProductQuery({ sku });
  });

  const slug = slugify(row.productName);
  if (slug) {
    addProductQuery({ slug });
  }

  const cleanSlug = slugify(cleanName);
  if (cleanSlug && cleanSlug !== slug) {
    addProductQuery({ slug: cleanSlug });
  }

  searchTerms.forEach((search) => {
    addProductQuery({ search });
  });

  const productsById = new Map();

  for (const query of queries) {
    const products = await wooFetch(credentials, query);
    if (Array.isArray(products)) {
      products.forEach((product) => productsById.set(product.id, product));
    }
    if (productsById.size >= 120) break;
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
    sheetName: row.sheetName || '',
    sheetGid: row.sheetGid || '',
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

export async function getWooProductTabs({ wpUrl, consumerKey, consumerSecret, productId, barn2TabKeys = {} }) {
  const credentials = { wpUrl, consumerKey, consumerSecret };
  const barn2 = await loadBarn2GlobalTabs(credentials, barn2TabKeys);
  const product = await wooFetch(credentials, `/products/${encodeURIComponent(productId)}?context=edit`);

  return {
    product: compactProduct(product, wpUrl),
    tabs: mergeProductTabs(product, barn2.tabs),
    metaKeys: {
      customTabs: CUSTOM_TABS_META_KEY,
      usage: USAGE_META_KEY,
      storage: STORAGE_META_KEY,
      barn2FieldPrefix: BARN2_FIELD_PREFIX,
      barn2OverridePrefix: BARN2_OVERRIDE_PREFIX,
    },
    integrations: {
      barn2: {
        available: barn2.available,
        tabCount: barn2.tabs.length,
        warning: barn2.warning,
      },
    },
  };
}

export async function saveWooProductTabs({ wpUrl, consumerKey, consumerSecret, productId, tabs = [], barn2TabKeys = {} }) {
  const credentials = { wpUrl, consumerKey, consumerSecret };
  const normalizedTabs = normalizeManualTabs(tabs);

  if (!productId) {
    throw new Error('Thiếu productId.');
  }

  if (!normalizedTabs.length) {
    throw new Error('Cần nhập ít nhất 1 tab có tiêu đề và nội dung.');
  }

  const legacyMeta = getLegacyMetaFromTabs(normalizedTabs);
  const barn2 = await loadBarn2GlobalTabs(credentials, barn2TabKeys);
  const barn2Meta = buildBarn2MetaForTabs(normalizedTabs, barn2.tabs);
  const currentProduct = await wooFetch(credentials, `/products/${encodeURIComponent(productId)}?context=edit`);
  const metaItems = [
    { key: CUSTOM_TABS_META_KEY, value: JSON.stringify(normalizedTabs) },
    { key: USAGE_META_KEY, value: legacyMeta.usageHtml },
    { key: STORAGE_META_KEY, value: legacyMeta.storageHtml },
    ...barn2Meta.metaData,
  ];

  await wooFetch(credentials, `/products/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      meta_data: buildMetaUpdateItems(currentProduct, metaItems),
    }),
  });

  const updatedProduct = await wooFetch(credentials, `/products/${encodeURIComponent(productId)}?context=edit`);
  const savedCustomTabs = parseCustomTabs(getMetaValue(updatedProduct, CUSTOM_TABS_META_KEY));
  const barn2Verification = verifyBarn2Mappings(updatedProduct, barn2Meta.mappings, normalizedTabs);
  const tggVerified = JSON.stringify(savedCustomTabs) === JSON.stringify(normalizedTabs);

  return {
    success: true,
    product: compactProduct(updatedProduct, wpUrl),
    tabs: mergeProductTabs(updatedProduct, barn2.tabs),
    savedCount: savedCustomTabs.length,
    verified: tggVerified && (!barn2.available || !barn2Meta.mappings.length || barn2Verification.verified),
    metaKeys: {
      customTabs: CUSTOM_TABS_META_KEY,
      usage: USAGE_META_KEY,
      storage: STORAGE_META_KEY,
      barn2FieldPrefix: BARN2_FIELD_PREFIX,
      barn2OverridePrefix: BARN2_OVERRIDE_PREFIX,
    },
    integrations: {
      tgg: {
        verified: tggVerified,
      },
      barn2: {
        available: barn2.available,
        tabCount: barn2.tabs.length,
        matchedCount: barn2Verification.matchedCount,
        verified: barn2Verification.verified,
        mappings: barn2Verification.mappings,
        warning: barn2.available
          ? barn2Meta.mappings.length
            ? ''
            : 'Không match được tiêu đề tab với Barn2 Product Tabs.'
          : barn2.warning,
      },
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

export async function previewProductTabSync({ wpUrl, consumerKey, consumerSecret, sheetUrl, minConfidence = DEFAULT_MIN_CONFIDENCE, barn2TabKeys = {}, scanAllSheets = false }) {
  const { source, rows } = await loadProductTabRows(sheetUrl, { scanAllSheets });
  const credentials = { wpUrl, consumerKey, consumerSecret };
  const confidence = Number(minConfidence) || DEFAULT_MIN_CONFIDENCE;
  const barn2 = await loadBarn2GlobalTabs(credentials, barn2TabKeys);

  const matches = await mapWithConcurrency(rows, 4, async (row) => {
    try {
      return await findProductMatch(credentials, row, confidence);
    } catch (error) {
      return {
        rowNumber: row.rowNumber,
        sheetIndex: row.sheetIndex,
        sheetName: row.sheetName || '',
        sheetGid: row.sheetGid || '',
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
      barn2FieldPrefix: BARN2_FIELD_PREFIX,
      barn2OverridePrefix: BARN2_OVERRIDE_PREFIX,
    },
    integrations: {
      barn2: {
        available: barn2.available,
        tabCount: barn2.tabs.length,
        warning: barn2.warning,
      },
    },
    matches,
  };
}

function escapeSheetNameForRange(name = '') {
  return `'${String(name || '').replace(/'/g, "''")}'`;
}

async function getSpreadsheetSheets(auth, spreadsheetId) {
  const sheetsApi = google.sheets({ version: 'v4', auth });
  const response = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))',
  });

  return (response.data.sheets || []).map((sheet) => sheet.properties || {});
}

function resolveSheetTitleForRow(row, source, sheets = []) {
  if (row.sheetName && !/^gid:/i.test(row.sheetName)) {
    return row.sheetName;
  }

  const gid = row.sheetGid || source.gid;
  const byGid = sheets.find((sheet) => String(sheet.sheetId) === String(gid));
  if (byGid?.title) return byGid.title;

  return sheets[0]?.title || row.sheetName || '';
}

function buildCatalogStatus(match) {
  if (match?.matched) return '';
  if (match?.matchType === 'error' || match?.error) return 'Lỗi kiểm tra';
  if (match?.bestCandidate) return 'Cần kiểm tra';
  return 'Không có trong danh mục sản phẩm';
}

export async function markMissingProductsInSheet({
  wpUrl,
  consumerKey,
  consumerSecret,
  sheetUrl,
  minConfidence = DEFAULT_MIN_CONFIDENCE,
  scanAllSheets = false,
  googleAuth,
}) {
  if (!googleAuth) {
    throw new Error('Chưa kết nối Google Sheets.');
  }

  const { source, rows } = await loadProductTabRows(sheetUrl, { scanAllSheets });

  if (!source.spreadsheetId) {
    throw new Error('Chỉ hỗ trợ ghi vào Google Sheet URL gốc, không hỗ trợ CSV export URL.');
  }

  const credentials = { wpUrl, consumerKey, consumerSecret };
  const confidence = Number(minConfidence) || DEFAULT_MIN_CONFIDENCE;
  const spreadsheetSheets = await getSpreadsheetSheets(googleAuth, source.spreadsheetId);
  const matches = await mapWithConcurrency(rows, 4, async (row) => {
    try {
      const match = await findProductMatch(credentials, row, confidence);
      return {
        ...match,
        headerRowNumber: row.headerRowNumber,
        catalogStatus: buildCatalogStatus(match),
      };
    } catch (error) {
      return {
        rowNumber: row.rowNumber,
        headerRowNumber: row.headerRowNumber,
        sheetIndex: row.sheetIndex,
        sheetName: row.sheetName || '',
        sheetGid: row.sheetGid || '',
        productName: row.productName,
        matched: false,
        confidence: 0,
        matchType: 'error',
        product: null,
        bestCandidate: null,
        candidates: [],
        error: error.message,
        catalogStatus: 'Lỗi kiểm tra',
      };
    }
  });

  const data = [];
  const sheetsTouched = new Set();
  const headerRanges = new Set();

  matches.forEach((match) => {
    const sheetTitle = resolveSheetTitleForRow(match, source, spreadsheetSheets);
    if (!sheetTitle || !match.rowNumber) return;

    const escapedTitle = escapeSheetNameForRange(sheetTitle);
    const headerRowNumber = Number(match.headerRowNumber) || 1;
    const headerRange = `${escapedTitle}!E${headerRowNumber}`;
    sheetsTouched.add(sheetTitle);

    if (!headerRanges.has(headerRange)) {
      headerRanges.add(headerRange);
      data.push({
        range: headerRange,
        values: [['Trạng thái WP']],
      });
    }

    data.push({
      range: `${escapedTitle}!E${match.rowNumber}`,
      values: [[match.catalogStatus]],
    });
  });

  if (!data.length) {
    throw new Error('Không có dòng nào để ghi vào Google Sheet.');
  }

  const sheetsApi = google.sheets({ version: 'v4', auth: googleAuth });
  const updateResponse = await sheetsApi.spreadsheets.values.batchUpdate({
    spreadsheetId: source.spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data,
    },
  });

  const matchedCount = matches.filter((match) => match.matched).length;
  const needsReviewCount = matches.filter((match) => match.catalogStatus === 'Cần kiểm tra').length;
  const missingCount = matches.filter((match) => match.catalogStatus === 'Không có trong danh mục sản phẩm').length;
  const errorCount = matches.filter((match) => match.catalogStatus === 'Lỗi kiểm tra').length;

  return {
    source,
    minConfidence: confidence,
    totalRows: rows.length,
    matchedCount,
    skippedCount: rows.length - matchedCount,
    needsReviewCount,
    missingCount,
    errorCount,
    updatedCells: updateResponse.data.totalUpdatedCells || 0,
    updatedRanges: updateResponse.data.totalUpdatedRanges || data.length,
    sheetsUpdated: sheetsTouched.size,
    statusColumn: 'E',
    statusHeader: 'Trạng thái WP',
    matches,
  };
}

export async function syncProductTabs({ wpUrl, consumerKey, consumerSecret, sheetUrl, minConfidence = DEFAULT_MIN_CONFIDENCE, barn2TabKeys = {}, scanAllSheets = false, syncTarget = 'both' }) {
  const { source, rows } = await loadProductTabRows(sheetUrl, { scanAllSheets });
  const credentials = { wpUrl, consumerKey, consumerSecret };
  const confidence = Number(minConfidence) || DEFAULT_MIN_CONFIDENCE;
  const target = normalizeSyncTarget(syncTarget);
  const updateUsage = shouldSyncUsage(target);
  const updateStorage = shouldSyncStorage(target);
  const touchedProducts = new Set();
  const barn2 = await loadBarn2GlobalTabs(credentials, barn2TabKeys);

  const results = await mapWithConcurrency(rows, 3, async (row) => {
    try {
      const match = await findProductMatch(credentials, row, confidence);

      if (!match.matched) {
        return {
          ...match,
          action: 'skipped',
          reason: match.bestCandidate ? 'low-confidence' : 'not-found',
          syncTarget: target,
        };
      }

      if (touchedProducts.has(match.product.id)) {
        return {
          ...match,
          action: 'skipped',
          reason: 'duplicate-product',
          syncTarget: target,
        };
      }

      touchedProducts.add(match.product.id);
      const rowTabs = normalizeManualTabs([
        ...(updateUsage ? [{ title: 'Hướng dẫn sử dụng', content: row.usageHtml, priority: 35 }] : []),
        ...(updateStorage ? [{ title: 'Hướng dẫn bảo quản', content: row.storageHtml, priority: 36 }] : []),
      ]);
      const barn2Meta = buildBarn2MetaForTabs(rowTabs, barn2.tabs);
      const currentProduct = await wooFetch(credentials, `/products/${match.product.id}?context=edit`);
      const metaItems = [
        ...(updateUsage ? [{ key: USAGE_META_KEY, value: row.usageHtml }] : []),
        ...(updateStorage ? [{ key: STORAGE_META_KEY, value: row.storageHtml }] : []),
        ...barn2Meta.metaData,
      ];

      await wooFetch(credentials, `/products/${match.product.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          meta_data: buildMetaUpdateItems(currentProduct, metaItems),
        }),
      });

      const updatedProduct = await wooFetch(credentials, `/products/${match.product.id}?context=edit`);
      const usageValue = getMetaValue(updatedProduct, USAGE_META_KEY);
      const storageValue = getMetaValue(updatedProduct, STORAGE_META_KEY);
      const usageSaved = updateUsage ? isMetaValueSaved(updatedProduct, USAGE_META_KEY, row.usageHtml) : true;
      const storageSaved = updateStorage ? isMetaValueSaved(updatedProduct, STORAGE_META_KEY, row.storageHtml) : true;
      const barn2Verification = verifyBarn2Mappings(updatedProduct, barn2Meta.mappings, rowTabs);

      return {
        ...match,
        product: compactProduct(updatedProduct, wpUrl),
        action: 'updated',
        syncTarget: target,
        usageUpdated: updateUsage && Boolean(row.usageHtml),
        storageUpdated: updateStorage && Boolean(row.storageHtml),
        usageSaved,
        storageSaved,
        verified: usageSaved && storageSaved && (!barn2.available || !barn2Meta.mappings.length || barn2Verification.verified),
        integrations: {
          barn2: {
            available: barn2.available,
            tabCount: barn2.tabs.length,
            matchedCount: barn2Verification.matchedCount,
            verified: barn2Verification.verified,
            mappings: barn2Verification.mappings,
            warning: barn2.available
              ? barn2Meta.mappings.length
                ? ''
                : 'Không match được tiêu đề tab với Barn2 Product Tabs.'
              : barn2.warning,
          },
        },
        savedMetaLengths: {
          usage: String(usageValue).length,
          storage: String(storageValue).length,
        },
      };
    } catch (error) {
      return {
        rowNumber: row.rowNumber,
        sheetIndex: row.sheetIndex,
        sheetName: row.sheetName || '',
        sheetGid: row.sheetGid || '',
        productName: row.productName,
        matched: false,
        confidence: 0,
        matchType: 'error',
        product: null,
        bestCandidate: null,
        candidates: [],
        action: 'error',
        syncTarget: target,
        error: error.message,
      };
    }
  });

  const updatedCount = results.filter((result) => result.action === 'updated').length;
  const verifiedCount = results.filter((result) => result.action === 'updated' && result.verified).length;
  const skippedCount = results.filter((result) => result.action === 'skipped').length;
  const errorCount = results.filter((result) => result.action === 'error').length;

  return {
    source,
    totalRows: rows.length,
    updatedCount,
    verifiedCount,
    skippedCount,
    errorCount,
    minConfidence: confidence,
    syncTarget: target,
    metaKeys: {
      usage: USAGE_META_KEY,
      storage: STORAGE_META_KEY,
      barn2FieldPrefix: BARN2_FIELD_PREFIX,
      barn2OverridePrefix: BARN2_OVERRIDE_PREFIX,
    },
    integrations: {
      barn2: {
        available: barn2.available,
        tabCount: barn2.tabs.length,
        warning: barn2.warning,
      },
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
