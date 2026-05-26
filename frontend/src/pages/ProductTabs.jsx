import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  FileText,
  KeyRound,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { productTabsAPI } from '../utils/api';

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

export default function ProductTabs() {
  const [form, setForm] = useState({
    wpUrl: localStorage.getItem('woo_wp_url') || localStorage.getItem('wp_url') || '',
    wooConsumerKey: localStorage.getItem('woo_consumer_key') || '',
    wooConsumerSecret: localStorage.getItem('woo_consumer_secret') || '',
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

  const credentials = useMemo(() => ({
    wpUrl: form.wpUrl,
    wooConsumerKey: form.wooConsumerKey,
    wooConsumerSecret: form.wooConsumerSecret,
  }), [form.wpUrl, form.wooConsumerKey, form.wooConsumerSecret]);

  const activeTab = tabs[activeTabIndex] || tabs[0] || cloneDefaultTabs()[0];
  const canSave = Boolean(selectedProduct && tabs.some((tab) => tab.title.trim() && tab.content.trim()));

  const persistCredentials = () => {
    localStorage.setItem('woo_wp_url', form.wpUrl);
    localStorage.setItem('wp_url', form.wpUrl);
    localStorage.setItem('woo_consumer_key', form.wooConsumerKey);
    localStorage.setItem('woo_consumer_secret', form.wooConsumerSecret);
  };

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
            Đã lưu {success.savedCount || tabs.length} tab cho {success.product?.name || selectedProduct?.name}.
          </span>
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
