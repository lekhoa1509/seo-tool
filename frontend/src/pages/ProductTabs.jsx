import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  FileText,
  KeyRound,
  Loader2,
  Link2,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  Table,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { productTabsAPI } from '../utils/api';

const DEFAULT_PRODUCT_TABS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/18QrqwiFxNmAf9OoriH9gbJhtEZvD6XeY/edit?pli=1&gid=1356650069#gid=1356650069';
const DEFAULT_BARN2_USAGE_TAB_KEY = 'wpt-38110';
const DEFAULT_BARN2_STORAGE_TAB_KEY = 'wpt-38106';
const SHEET_ROWS_PAGE_SIZE = 12;

const DEFAULT_TABS = [
  { title: 'Thông số kỹ thuật', content: '', priority: 34 },
  { title: 'Hướng dẫn sử dụng', content: '', priority: 35 },
];

function cloneDefaultTabs() {
  return DEFAULT_TABS.map((tab) => ({ ...tab }));
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

function hasHtmlTags(value = '') {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
}

function textToPreviewHtml(value = '') {
  const lines = String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return '<p class="text-slate-400 italic">Chưa có nội dung preview.</p>';

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

function tabPreviewHtml(content = '') {
  const text = String(content || '').trim();
  if (!text) return '<p class="text-slate-400 italic">Chưa có nội dung preview.</p>';
  return hasHtmlTags(text) ? text : textToPreviewHtml(text);
}

function normalizeErrorMessage(message, fallback = 'Có lỗi xảy ra') {
  return String(message || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || fallback;
}

function formatMoney(value) {
  if (!value) return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return number.toLocaleString('vi-VN');
}

function formatConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '-';
  return `${Math.round(number * 100)}%`;
}

function formatSheetRow(row) {
  const sheet = row?.sheetName ? row.sheetName.replace(/^\d+\.\s*/, '') : '';
  const index = row?.sheetIndex || row?.rowNumber || '-';
  return sheet ? `${sheet} / ${index}` : index;
}

function matchLabel(match) {
  if (match?.error || match?.matchType === 'error') return 'Lỗi';
  if (match?.matched) return match.matchType === 'exact' ? 'Exact' : 'Match';
  if (match?.bestCandidate) return 'Cần kiểm tra';
  return 'Không thấy';
}

function syncActionLabel(row) {
  const barn2 = row?.integrations?.barn2;
  const targetLabel = row?.syncTarget === 'usage'
    ? 'HDSD'
    : row?.syncTarget === 'storage'
      ? 'bảo quản'
      : 'Product Tabs';

  if (row?.action === 'updated' && barn2?.verified) return `Đã lưu ${targetLabel}`;
  if (row?.action === 'updated' && barn2?.available && !barn2?.verified) return `Chưa xác nhận ${targetLabel}`;
  if (row?.action === 'updated' && row?.verified) return 'Đã lưu TGG meta';
  if (row?.action === 'updated') return 'Đã gọi API';
  if (row?.action === 'skipped') return 'Bỏ qua';
  if (row?.action === 'error') return 'Lỗi';
  return matchLabel(row);
}

function syncTargetStatLabel(target = 'both') {
  if (target === 'usage') return 'Đã lưu HDSD';
  if (target === 'storage') return 'Đã lưu bảo quản';
  return 'Đã lưu Product Tabs';
}

function catalogStatusLabel(row) {
  return row?.catalogStatus || (row?.matched ? 'Có trong WP' : matchLabel(row));
}

function catalogStatusClass(row) {
  if (row?.catalogStatus === 'Không có trong danh mục sản phẩm') return 'bg-rose-50 text-rose-700 border-rose-100';
  if (row?.catalogStatus === 'Cần kiểm tra') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (row?.catalogStatus === 'Lỗi kiểm tra') return 'bg-rose-50 text-rose-700 border-rose-100';
  if (row?.matched) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  return matchClass(row);
}

function matchClass(match) {
  if (match?.error || match?.matchType === 'error') return 'bg-rose-50 text-rose-700 border-rose-100';
  if (match?.matched && match?.matchType === 'exact') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (match?.matched) return 'bg-blue-50 text-blue-700 border-blue-100';
  if (match?.bestCandidate) return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

export default function ProductTabs() {
  const [form, setForm] = useState({
    wpUrl: localStorage.getItem('woo_wp_url') || localStorage.getItem('wp_url') || '',
    wooConsumerKey: localStorage.getItem('woo_consumer_key') || '',
    wooConsumerSecret: localStorage.getItem('woo_consumer_secret') || '',
    barn2UsageTabKey: localStorage.getItem('barn2_usage_tab_key') || DEFAULT_BARN2_USAGE_TAB_KEY,
    barn2StorageTabKey: localStorage.getItem('barn2_storage_tab_key') || DEFAULT_BARN2_STORAGE_TAB_KEY,
    search: '',
    perPage: 20,
  });
  const [products, setProducts] = useState([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, totalPages: 1, total: 0 });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [tabs, setTabs] = useState(cloneDefaultTabs);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [sheetForm, setSheetForm] = useState({
    sheetUrl: localStorage.getItem('product_tabs_sheet_url') || DEFAULT_PRODUCT_TABS_SHEET_URL,
    minConfidence: Number(localStorage.getItem('product_tabs_min_confidence') || 0.82),
    scanAllSheets: localStorage.getItem('product_tabs_scan_all_sheets') !== 'false',
  });
  const [sheetPreview, setSheetPreview] = useState(null);
  const [sheetSyncResult, setSheetSyncResult] = useState(null);
  const [sheetMarkResult, setSheetMarkResult] = useState(null);
  const [sheetError, setSheetError] = useState('');
  const [previewingSheet, setPreviewingSheet] = useState(false);
  const [syncingSheetTarget, setSyncingSheetTarget] = useState('');
  const [markingMissing, setMarkingMissing] = useState(false);
  const [googleStatus, setGoogleStatus] = useState({ connected: false, configured: false, sheetsConnected: false });
  const [sheetPage, setSheetPage] = useState(1);

  const credentials = useMemo(() => ({
    wpUrl: form.wpUrl,
    wooConsumerKey: form.wooConsumerKey,
    wooConsumerSecret: form.wooConsumerSecret,
    barn2UsageTabKey: form.barn2UsageTabKey,
    barn2StorageTabKey: form.barn2StorageTabKey,
  }), [form.wpUrl, form.wooConsumerKey, form.wooConsumerSecret, form.barn2UsageTabKey, form.barn2StorageTabKey]);

  const activeTab = tabs[activeTabIndex] || tabs[0] || cloneDefaultTabs()[0];
  const canSave = Boolean(selectedProduct && tabs.some((tab) => tab.title.trim() && tab.content.trim()));
  const sheetRows = sheetPreview?.matches || sheetSyncResult?.results || sheetMarkResult?.matches || [];
  const sheetTotalPages = Math.max(1, Math.ceil(sheetRows.length / SHEET_ROWS_PAGE_SIZE));
  const currentSheetPage = Math.min(sheetPage, sheetTotalPages);
  const sheetStartIndex = (currentSheetPage - 1) * SHEET_ROWS_PAGE_SIZE;
  const visibleSheetRows = sheetRows.slice(sheetStartIndex, sheetStartIndex + SHEET_ROWS_PAGE_SIZE);
  const sheetEndIndex = sheetStartIndex + visibleSheetRows.length;
  const sheetBarn2 = sheetPreview?.integrations?.barn2 || sheetSyncResult?.integrations?.barn2;
  const syncingSheet = Boolean(syncingSheetTarget);
  const canSyncSheet = Boolean(sheetPreview?.matchedCount || sheetSyncResult?.updatedCount);
  const showingMarkResult = Boolean(sheetMarkResult && !sheetPreview && !sheetSyncResult);

  const fetchGoogleStatus = async () => {
    try {
      const result = await productTabsAPI.googleStatus();
      setGoogleStatus(result);
    } catch {}
  };

  useEffect(() => {
    fetchGoogleStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get('googleConnected') === 'true') {
      window.history.replaceState({}, '', '/product-tabs');
    }
  }, []);

  const persistCredentials = () => {
    localStorage.setItem('woo_wp_url', form.wpUrl);
    localStorage.setItem('wp_url', form.wpUrl);
    localStorage.setItem('woo_consumer_key', form.wooConsumerKey);
    localStorage.setItem('woo_consumer_secret', form.wooConsumerSecret);
    localStorage.setItem('barn2_usage_tab_key', form.barn2UsageTabKey);
    localStorage.setItem('barn2_storage_tab_key', form.barn2StorageTabKey);
  };

  const persistSheetForm = () => {
    persistCredentials();
    localStorage.setItem('product_tabs_sheet_url', sheetForm.sheetUrl);
    localStorage.setItem('product_tabs_min_confidence', String(sheetForm.minConfidence));
    localStorage.setItem('product_tabs_scan_all_sheets', String(sheetForm.scanAllSheets));
  };

  const updateSheetForm = (patch) => {
    setSheetForm((current) => ({ ...current, ...patch }));
    setSheetPreview(null);
    setSheetSyncResult(null);
    setSheetMarkResult(null);
    setSheetError('');
    setSheetPage(1);
  };

  const buildSheetPayload = () => ({
    ...credentials,
    sheetUrl: sheetForm.sheetUrl,
    minConfidence: Number(sheetForm.minConfidence) || 0.82,
    scanAllSheets: sheetForm.scanAllSheets,
  });

  const scanProducts = async (page = 1) => {
    setLoadingProducts(true);
    setError('');
    setSuccess(null);
    persistCredentials();

    try {
      const result = await productTabsAPI.listProducts({
        ...credentials,
        search: form.search,
        page,
        perPage: Number(form.perPage) || 20,
        status: 'any',
      });

      setProducts(result.products || []);
      setPageInfo({
        page: result.page || page,
        totalPages: result.totalPages || 1,
        total: result.total || 0,
      });
    } catch (err) {
      setError(normalizeErrorMessage(err.message, 'Không quét được sản phẩm WooCommerce'));
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleScan = (event) => {
    event.preventDefault();
    scanProducts(1);
  };

  const loadProductTabs = async (product) => {
    setSelectedProduct(product);
    setLoadingProduct(true);
    setError('');
    setSuccess(null);
    setActiveTabIndex(0);

    try {
      const result = await productTabsAPI.getProduct({
        ...credentials,
        productId: product.id,
      });
      const loadedTabs = Array.isArray(result.tabs) && result.tabs.length
        ? result.tabs.map((tab, index) => ({
          title: tab.title || `Tab ${index + 1}`,
          content: tab.content || '',
          priority: tab.priority || 34 + index,
        }))
        : cloneDefaultTabs();

      setSelectedProduct(result.product || product);
      setTabs(loadedTabs);
    } catch (err) {
      setTabs(cloneDefaultTabs());
      setError(normalizeErrorMessage(err.message, 'Không đọc được tab của sản phẩm'));
    } finally {
      setLoadingProduct(false);
    }
  };

  const updateTab = (index, patch) => {
    setTabs((current) => current.map((tab, tabIndex) => (
      tabIndex === index ? { ...tab, ...patch } : tab
    )));
    setSuccess(null);
  };

  const addTab = () => {
    setTabs((current) => {
      const next = [
        ...current,
        { title: `Tab ${current.length + 1}`, content: '', priority: 34 + current.length },
      ];
      setActiveTabIndex(next.length - 1);
      return next;
    });
    setSuccess(null);
  };

  const removeTab = (index) => {
    setTabs((current) => {
      const next = current.filter((_, tabIndex) => tabIndex !== index);
      setActiveTabIndex(Math.max(0, Math.min(activeTabIndex, next.length - 1)));
      return next.length ? next : cloneDefaultTabs();
    });
    setSuccess(null);
  };

  const saveTabs = async () => {
    if (!selectedProduct || !canSave) return;

    setSaving(true);
    setError('');
    setSuccess(null);
    persistCredentials();

    try {
      const result = await productTabsAPI.saveProductTabs({
        ...credentials,
        productId: selectedProduct.id,
        tabs,
      });

      setSuccess(result);
      setSelectedProduct(result.product || selectedProduct);
      if (Array.isArray(result.tabs) && result.tabs.length) {
        setTabs(result.tabs);
      }
    } catch (err) {
      setError(normalizeErrorMessage(err.message, 'Không lưu được tab sản phẩm'));
    } finally {
      setSaving(false);
    }
  };

  const previewSheetSync = async (event) => {
    event.preventDefault();
    setPreviewingSheet(true);
    setSheetError('');
    setSheetSyncResult(null);
    persistSheetForm();

    try {
      const result = await productTabsAPI.previewSync(buildSheetPayload());
      setSheetPreview(result);
      setSheetMarkResult(null);
      setSheetPage(1);
    } catch (err) {
      setSheetError(normalizeErrorMessage(err.message, 'Không preview được dữ liệu Google Sheet'));
    } finally {
      setPreviewingSheet(false);
    }
  };

  const syncSheetTabs = async (syncTarget) => {
    setSyncingSheetTarget(syncTarget);
    setSheetError('');
    persistSheetForm();

    try {
      const result = await productTabsAPI.syncFromSheet({
        ...buildSheetPayload(),
        syncTarget,
      });
      setSheetSyncResult(result);
      setSheetPreview(null);
      setSheetMarkResult(null);
      setSheetPage(1);

      const updatedSelectedProduct = (result.results || []).find((row) => (
        row.action === 'updated' && row.product?.id === selectedProduct?.id
      ))?.product;

      if (updatedSelectedProduct) {
        await loadProductTabs(updatedSelectedProduct);
      }
    } catch (err) {
      setSheetError(normalizeErrorMessage(err.message, 'Không cập nhật được tab sản phẩm'));
    } finally {
      setSyncingSheetTarget('');
    }
  };

  const connectGoogleSheets = async () => {
    setSheetError('');

    try {
      const result = await productTabsAPI.googleAuth();
      if (result.authUrl) {
        window.location.href = result.authUrl;
      }
    } catch (err) {
      setSheetError(normalizeErrorMessage(err.message, 'Không kết nối được Google Sheets'));
    }
  };

  const markMissingProducts = async () => {
    setMarkingMissing(true);
    setSheetError('');
    persistSheetForm();

    try {
      const result = await productTabsAPI.markMissingProducts(buildSheetPayload());
      setSheetMarkResult(result);
      setSheetPreview(null);
      setSheetSyncResult(null);
      setSheetPage(1);
      await fetchGoogleStatus();
    } catch (err) {
      setSheetError(normalizeErrorMessage(err.message, 'Không ghi được cột trạng thái vào Google Sheet'));
    } finally {
      setMarkingMissing(false);
    }
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <Package size={24} className="text-cyan-500" />
          Tab sản phẩm WooCommerce
        </h1>
        <p className="mt-1 text-sm text-slate-500">Quét sản phẩm, nhập nội dung tab, lưu trực tiếp vào WooCommerce.</p>
      </div>

      <form onSubmit={handleScan} className="card p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="label">URL Website WordPress *</label>
            <input
              type="url"
              className="input"
              placeholder="https://paper.vn"
              value={form.wpUrl}
              onChange={(event) => setForm({ ...form, wpUrl: event.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Tìm sản phẩm</label>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                className="input pl-9"
                placeholder="Tên, SKU hoặc slug sản phẩm"
                value={form.search}
                onChange={(event) => setForm({ ...form, search: event.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_160px]">
          <div>
            <label className="label">WooCommerce Consumer Key *</label>
            <div className="relative">
              <KeyRound size={15} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
              <input
                type="password"
                className="input pl-9"
                placeholder="ck_..."
                value={form.wooConsumerKey}
                onChange={(event) => setForm({ ...form, wooConsumerKey: event.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <label className="label">WooCommerce Consumer Secret *</label>
            <div className="relative">
              <KeyRound size={15} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
              <input
                type="password"
                className="input pl-9"
                placeholder="cs_..."
                value={form.wooConsumerSecret}
                onChange={(event) => setForm({ ...form, wooConsumerSecret: event.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Số sản phẩm</label>
            <select
              className="input"
              value={form.perPage}
              onChange={(event) => setForm({ ...form, perPage: Number(event.target.value) })}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <label className="label">Barn2 tab key - Hướng dẫn sử dụng</label>
            <input
              type="text"
              className="input"
              value={form.barn2UsageTabKey}
              onChange={(event) => setForm({ ...form, barn2UsageTabKey: event.target.value })}
            />
          </div>
          <div>
            <label className="label">Barn2 tab key - Hướng dẫn bảo quản</label>
            <input
              type="text"
              className="input"
              value={form.barn2StorageTabKey}
              onChange={(event) => setForm({ ...form, barn2StorageTabKey: event.target.value })}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button type="submit" className="btn-primary" disabled={loadingProducts || loadingProduct || saving}>
            {loadingProducts ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Quét sản phẩm
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={() => scanProducts(pageInfo.page)}
            disabled={loadingProducts || !products.length}
          >
            <RefreshCw size={16} />
            Tải lại
          </button>
          {pageInfo.total > 0 && (
            <span className="text-sm text-slate-500">
              {pageInfo.total} sản phẩm - trang {pageInfo.page}/{pageInfo.totalPages}
            </span>
          )}
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <Table size={18} className="text-blue-500" />
              Cập nhật từ Google Sheet
            </h2>
            <p className="mt-1 text-sm text-slate-500">Ghi vào Hướng dẫn sử dụng và Hướng dẫn bảo quản theo từng sản phẩm.</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
            Match tên/SKU/slug
          </span>
        </div>

        <form onSubmit={previewSheetSync} className="space-y-4 p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
            <div>
              <label className="label">Google Sheet URL *</label>
              <input
                type="url"
                className="input"
                value={sheetForm.sheetUrl}
                onChange={(event) => updateSheetForm({ sheetUrl: event.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Độ khớp tối thiểu</label>
              <input
                type="number"
                min="0.6"
                max="1"
                step="0.01"
                className="input"
                value={sheetForm.minConfidence}
                onChange={(event) => updateSheetForm({ minConfidence: event.target.value })}
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              checked={sheetForm.scanAllSheets}
              onChange={(event) => updateSheetForm({ scanAllSheets: event.target.checked })}
            />
            Quét tất cả sheet/tab trong file
          </label>

          {sheetError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              {sheetError}
            </div>
          )}

          {sheetBarn2?.warning && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              {sheetBarn2.warning}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <button type="submit" className="btn-outline" disabled={previewingSheet || syncingSheet || markingMissing}>
              {previewingSheet ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Preview match
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => syncSheetTabs('usage')}
              disabled={syncingSheet || previewingSheet || markingMissing || !canSyncSheet}
            >
              {syncingSheetTarget === 'usage' ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              Cập nhật Hướng dẫn sử dụng (C)
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => syncSheetTabs('storage')}
              disabled={syncingSheet || previewingSheet || markingMissing || !canSyncSheet}
            >
              {syncingSheetTarget === 'storage' ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              Cập nhật Hướng dẫn bảo quản (D)
            </button>
            {googleStatus.sheetsConnected ? (
              <button
                type="button"
                className="btn-outline"
                onClick={markMissingProducts}
                disabled={markingMissing || syncingSheet || previewingSheet}
              >
                {markingMissing ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                Đánh dấu thiếu cột E
              </button>
            ) : (
              <button
                type="button"
                className="btn-outline"
                onClick={connectGoogleSheets}
                disabled={markingMissing || syncingSheet || previewingSheet}
              >
                <Link2 size={16} />
                Kết nối Google Sheets
              </button>
            )}
            {sheetPreview?.matchedCount > 0 && (
              <span className="text-sm text-slate-500">
                Sẽ cập nhật {sheetPreview.matchedCount}/{sheetPreview.totalRows} sản phẩm.
              </span>
            )}
            {sheetMarkResult && (
              <span className="text-sm text-slate-500">
                Đã ghi cột E cho {sheetMarkResult.sheetsUpdated} sheet: {sheetMarkResult.missingCount} thiếu, {sheetMarkResult.needsReviewCount} cần kiểm tra.
              </span>
            )}
          </div>
        </form>

        {(sheetPreview || sheetSyncResult || sheetMarkResult) && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
            <div className="mb-4 grid gap-3 md:grid-cols-5">
              {(showingMarkResult ? [
                { label: 'Dòng sheet', value: sheetMarkResult?.totalRows },
                { label: 'Sheet đã ghi', value: sheetMarkResult?.sheetsUpdated },
                { label: 'Match được', value: sheetMarkResult?.matchedCount },
                { label: 'Không có trong WP', value: sheetMarkResult?.missingCount },
                { label: 'Cần kiểm tra', value: (sheetMarkResult?.needsReviewCount || 0) + (sheetMarkResult?.errorCount || 0) },
              ] : [
                { label: 'Dòng sheet', value: sheetPreview?.totalRows ?? sheetSyncResult?.totalRows },
                { label: 'Sheet đã quét', value: sheetPreview?.source?.sheetCount ?? sheetSyncResult?.source?.sheetCount ?? 1 },
                { label: sheetPreview ? 'Match được' : 'Đã cập nhật', value: sheetPreview?.matchedCount ?? sheetSyncResult?.updatedCount },
                {
                  label: sheetPreview
                    ? 'Bỏ qua'
                    : sheetSyncResult?.integrations?.barn2?.available
                      ? syncTargetStatLabel(sheetSyncResult?.syncTarget)
                      : 'Đã lưu TGG meta',
                  value: sheetPreview?.skippedCount ?? sheetSyncResult?.verifiedCount,
                },
                { label: 'Lỗi', value: sheetPreview?.errorCount ?? sheetSyncResult?.errorCount },
              ]).map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{item.label}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-800">{item.value ?? 0}</p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <div className="min-w-[920px]">
                <div className="grid grid-cols-[150px_1.4fr_1.4fr_110px_120px] gap-3 border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>Sheet / STT</span>
                  <span>Tên trong sheet</span>
                  <span>Sản phẩm WP</span>
                  <span>Độ khớp</span>
                  <span>Trạng thái</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {visibleSheetRows.map((row) => {
                    const product = row.product || row.bestCandidate;
                    const productHref = product?.editUrl || product?.permalink;

                    return (
                      <div key={`${row.sheetName || 'sheet'}-${row.rowNumber}-${row.productName}`} className="grid grid-cols-[150px_1.4fr_1.4fr_110px_120px] gap-3 px-4 py-3 text-sm">
                        <span className="break-words text-slate-400">{formatSheetRow(row)}</span>
                        <span className="min-w-0 break-words font-medium text-slate-700">{row.productName}</span>
                        <span className="min-w-0 break-words text-slate-600">
                          {product ? (
                            productHref ? (
                              <a href={productHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                                {product.name}
                                <ExternalLink size={12} />
                              </a>
                            ) : product.name
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </span>
                        <span className="text-slate-600">{formatConfidence(row.confidence)}</span>
                        <span>
                          <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${showingMarkResult ? catalogStatusClass(row) : matchClass(row)}`}>
                            {showingMarkResult ? catalogStatusLabel(row) : sheetSyncResult ? syncActionLabel(row) : matchLabel(row)}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {sheetRows.length > SHEET_ROWS_PAGE_SIZE && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <span>
                  Đang hiển thị {sheetStartIndex + 1}-{sheetEndIndex}/{sheetRows.length} dòng.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-outline text-xs"
                    disabled={currentSheetPage <= 1}
                    onClick={() => setSheetPage((page) => Math.max(1, page - 1))}
                  >
                    Trang trước
                  </button>
                  <span>{currentSheetPage}/{sheetTotalPages}</span>
                  <button
                    type="button"
                    className="btn-outline text-xs"
                    disabled={currentSheetPage >= sheetTotalPages}
                    onClick={() => setSheetPage((page) => Math.min(sheetTotalPages, page + 1))}
                  >
                    Trang sau
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <span className="flex items-center gap-2">
            <CheckCircle size={16} />
            {success.integrations?.barn2?.verified
              ? `Đã lưu Product Tabs cho ${success.product?.name || selectedProduct?.name}.`
              : `Đã lưu ${success.savedCount || tabs.length} tab cho ${success.product?.name || selectedProduct?.name}.`}
          </span>
          {success.integrations?.barn2?.warning && (
            <span className="basis-full text-xs text-amber-700">
              Product Tabs: {success.integrations.barn2.warning}
            </span>
          )}
          {success.product?.permalink && (
            <a href={success.product.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline">
              Xem sản phẩm
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.4fr)]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <Search size={18} className="text-blue-500" />
              Sản phẩm
            </h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
              {products.length} dòng
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {!products.length && (
              <div className="px-5 py-10 text-center text-sm text-slate-400">
                Chưa có dữ liệu sản phẩm.
              </div>
            )}

            {products.map((product) => {
              const selected = selectedProduct?.id === product.id;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => loadProductTabs(product)}
                  className={`flex w-full items-start gap-3 px-5 py-4 text-left transition-colors ${
                    selected ? 'bg-primary-50' : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <Package size={18} className="text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${selected ? 'text-primary-700' : 'text-slate-800'}`}>
                      {product.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>ID {product.id}</span>
                      {product.sku && <span>SKU {product.sku}</span>}
                      {product.price && <span>{formatMoney(product.price)} đ</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {products.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                type="button"
                className="btn-outline text-sm"
                disabled={loadingProducts || pageInfo.page <= 1}
                onClick={() => scanProducts(pageInfo.page - 1)}
              >
                Trang trước
              </button>
              <span className="text-xs text-slate-500">{pageInfo.page}/{pageInfo.totalPages}</span>
              <button
                type="button"
                className="btn-outline text-sm"
                disabled={loadingProducts || pageInfo.page >= pageInfo.totalPages}
                onClick={() => scanProducts(pageInfo.page + 1)}
              >
                Trang sau
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                  <FileText size={18} className="text-cyan-500" />
                  Nội dung tab
                </h2>
                {selectedProduct ? (
                  <p className="mt-1 text-sm text-slate-500">{selectedProduct.name}</p>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">Chọn một sản phẩm để nhập tab.</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedProduct?.editUrl && (
                  <a href={selectedProduct.editUrl} target="_blank" rel="noopener noreferrer" className="btn-outline text-sm">
                    <ExternalLink size={14} />
                    Mở WP
                  </a>
                )}
                <button type="button" className="btn-outline text-sm" onClick={addTab} disabled={tabs.length >= 8 || loadingProduct}>
                  <Plus size={14} />
                  Thêm tab
                </button>
                <button type="button" className="btn-primary text-sm" onClick={saveTabs} disabled={!canSave || loadingProduct || saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Lưu tab
                </button>
              </div>
            </div>

            {loadingProduct ? (
              <div className="flex items-center gap-3 px-5 py-10 text-sm text-slate-500">
                <Loader2 size={18} className="animate-spin text-primary-600" />
                Đang đọc tab sản phẩm...
              </div>
            ) : (
              <div className="p-5">
                <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
                  {tabs.map((tab, index) => (
                    <button
                      key={`${tab.title}-${index}`}
                      type="button"
                      onClick={() => setActiveTabIndex(index)}
                      className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        activeTabIndex === index ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {tab.title || `Tab ${index + 1}`}
                    </button>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div>
                    <label className="label">Tên tab *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="vd: Hướng dẫn sử dụng"
                      value={activeTab.title}
                      onChange={(event) => updateTab(activeTabIndex, { title: event.target.value })}
                      disabled={!selectedProduct}
                    />
                  </div>
                  <div>
                    <label className="label">Thứ tự</label>
                    <input
                      type="number"
                      className="input"
                      min={1}
                      value={activeTab.priority || 34 + activeTabIndex}
                      onChange={(event) => updateTab(activeTabIndex, { priority: Number(event.target.value) })}
                      disabled={!selectedProduct}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="label">Nội dung *</label>
                  <textarea
                    className="textarea min-h-[260px] font-mono text-sm"
                    placeholder={'Nhập nội dung tab. Có thể xuống dòng hoặc dùng bullet:\n- Dòng 1\n- Dòng 2'}
                    value={activeTab.content}
                    onChange={(event) => updateTab(activeTabIndex, { content: event.target.value })}
                    disabled={!selectedProduct}
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    className="btn-outline text-sm text-red-600 hover:bg-red-50"
                    onClick={() => removeTab(activeTabIndex)}
                    disabled={tabs.length <= 1}
                  >
                    <Trash2 size={14} />
                    Xóa tab này
                  </button>
                  <span className="text-xs text-slate-500">Tối đa 8 tab tùy chỉnh.</span>
                </div>
              </div>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-800">Preview</h2>
              <p className="mt-1 text-sm text-slate-500">{activeTab.title || 'Tab chưa đặt tên'}</p>
            </div>
            <div className="prose-content min-h-[180px] p-5" dangerouslySetInnerHTML={{ __html: tabPreviewHtml(activeTab.content) }} />
          </div>
        </div>
      </div>
    </div>
  );
}
