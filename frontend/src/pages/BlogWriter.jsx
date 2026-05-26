import React, { useState } from 'react';
import {
  PenTool, Loader2, Plus, X, Copy, Download, Sparkles,
  RefreshCw, CheckCircle, Tag, Clock, BookOpen, Wand2, Globe, Send,
  Image as ImageIcon, Package, Search, UploadCloud, AlertTriangle, KeyRound,
  ExternalLink, Table
} from 'lucide-react';
import { blogAPI } from '../utils/api';

const contentTypes = [
  { value: 'blog-post', label: 'Blog SEO', icon: PenTool },
  { value: 'product-post', label: 'Bài sản phẩm', icon: Package },
];

const DEFAULT_PRODUCT_TABS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/18QrqwiFxNmAf9OoriH9gbJhtEZvD6XeY/edit?pli=1&gid=1356650069#gid=1356650069';

function imageToSrc(image, outputFormat = 'png') {
  if (!image) return '';
  if (image.url) return image.url;
  if (!image.b64_json) return '';
  if (image.b64_json.startsWith('data:')) return image.b64_json;
  return `data:image/${outputFormat};base64,${image.b64_json}`;
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

function normalizeErrorMessage(message, fallback = 'Có lỗi xảy ra') {
  const cleaned = String(message || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/504 Gateway Time-out/i.test(cleaned)) {
    return 'AI provider bị timeout (504). Hãy thử lại; nút tạo bài đã dùng streaming để hạn chế lỗi request dài.';
  }

  return cleaned || fallback;
}

function buildImageFigure(featuredImage) {
  const src = imageToSrc(featuredImage?.image);
  if (!src) return '';

  const altText = featuredImage?.metadata?.altText || featuredImage?.metadata?.title || 'Featured image';
  const caption = featuredImage?.metadata?.caption || '';

  return `<figure class="featured-image"><img src="${escapeHtml(src)}" alt="${escapeHtml(altText)}" />${
    caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''
  }</figure>`;
}

function formatElapsed(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m${remainder ? ` ${remainder}s` : ''}`;
}

function FeaturedImageCard({ featuredImage, imageError, imageSrc, status, onDownload }) {
  if (!imageSrc && !imageError && !status) return null;

  const imageStatus = typeof status === 'string' ? { status, message: 'Đang tạo ảnh...' } : status;
  const imageLabel = imageStatus?.totalImages
    ? `Ảnh ${imageStatus.imageIndex || 1}/${imageStatus.totalImages}`
    : 'Ảnh 1/1';
  const elapsed = formatElapsed(imageStatus?.elapsedSeconds);
  const isDoneStatus = imageStatus?.status === 'image-complete';

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <ImageIcon size={16} className="text-teal-500" />
            Ảnh bài viết
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Model: {featuredImage?.model || 'cx/gpt-5.4-image'}</p>
        </div>
        {imageSrc && (
          <button type="button" onClick={onDownload} className="btn-outline text-sm">
            <Download size={14} />
            Tải ảnh
          </button>
        )}
      </div>

      <div className="p-5">
        {imageStatus && !imageSrc && !imageError && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-teal-100 bg-teal-50 px-4 py-3">
              {isDoneStatus ? (
                <CheckCircle size={17} className="mt-0.5 flex-shrink-0 text-teal-600" />
              ) : (
                <Loader2 size={17} className="mt-0.5 flex-shrink-0 animate-spin text-teal-600" />
              )}
              <div className="min-w-0 text-sm">
                <p className="font-medium text-slate-700">{imageStatus.message || 'Đang tạo ảnh...'}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {imageLabel}{elapsed ? ` - đã chờ ${elapsed}` : ''}
                </p>
              </div>
            </div>
            {!isDoneStatus && (
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-teal-500" />
              </div>
            )}
          </div>
        )}

        {imageError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Không tạo được ảnh: {imageError}
          </div>
        )}

        {imageSrc && (
          <div className="space-y-3">
            <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              <img src={imageSrc} alt={featuredImage?.metadata?.altText || 'Ảnh bài viết'} className="h-full w-full object-contain" />
            </div>
            {featuredImage?.metadata?.altText && (
              <p className="text-xs text-slate-500">{featuredImage.metadata.altText}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressItem({ label, detail, active, done, failed }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
        failed ? 'bg-rose-50 text-rose-600' : done ? 'bg-emerald-50 text-emerald-600' : active ? 'bg-primary-50 text-primary-600' : 'bg-slate-100 text-slate-400'
      }`}>
        {failed ? <X size={14} /> : done ? <CheckCircle size={14} /> : active ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {detail && <p className="text-xs text-slate-500">{detail}</p>}
      </div>
    </div>
  );
}

function StreamProgressPanel({ progress, includeImages, hasContent, imageSrc, imageError }) {
  const status = progress?.status || 'content-queued';
  const totalImages = progress?.totalImages ?? (includeImages ? 1 : 0);
  const elapsed = formatElapsed(progress?.elapsedSeconds);
  const contentDone = Boolean(['content-complete', 'image-queued', 'image-generating', 'image-complete', 'image-error', 'done'].includes(status) || imageSrc || imageError);
  const imageActive = includeImages && progress?.phase === 'image' && !imageSrc && !imageError && status !== 'image-complete';
  const imageDone = includeImages && Boolean(imageSrc || status === 'image-complete');
  const imageFailed = includeImages && Boolean(imageError || status === 'image-error');
  const currentMessage = progress?.message || (hasContent ? 'Đang nhận nội dung' : 'Đang kết nối tới AI');

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          {status === 'done' || imageDone ? (
            <CheckCircle size={16} className="text-emerald-600" />
          ) : (
            <Loader2 size={16} className="animate-spin text-primary-600" />
          )}
          {currentMessage}{elapsed ? ` - ${elapsed}` : ''}
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 ring-1 ring-slate-200">
          {includeImages ? `${totalImages || 1} ảnh` : 'Không tạo ảnh'}
        </span>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <ProgressItem
          label="Viết bài"
          detail={contentDone ? 'Đã nhận xong nội dung' : hasContent ? 'Đang stream nội dung về màn hình' : 'Đang khởi tạo'}
          active={!contentDone}
          done={contentDone}
        />
        {includeImages && (
          <ProgressItem
            label={`Tạo ảnh ${progress?.imageIndex || (imageDone || imageActive || imageFailed ? 1 : 0)}/${totalImages || 1}`}
            detail={imageFailed ? 'Tạo ảnh lỗi' : imageDone ? 'Đã có ảnh featured' : imageActive ? 'Request ảnh vẫn đang chạy' : 'Chờ bài viết hoàn tất'}
            active={imageActive}
            done={imageDone}
            failed={imageFailed}
          />
        )}
      </div>
    </div>
  );
}

function formatConfidence(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function matchLabel(match) {
  if (match?.error || match?.matchType === 'error') return 'Lỗi';
  if (match?.matched) return match.matchType === 'exact' ? 'Exact' : 'Match';
  if (match?.bestCandidate) return 'Cần kiểm tra';
  return 'Không thấy';
}

function syncActionLabel(row) {
  if (row?.action === 'updated' && row?.verified) return 'Đã lưu meta';
  if (row?.action === 'updated') return 'Đã gọi API';
  if (row?.action === 'skipped') return 'Bỏ qua';
  if (row?.action === 'error') return 'Lỗi';
  return matchLabel(row);
}

function matchClass(match) {
  if (match?.error || match?.matchType === 'error') return 'bg-rose-50 text-rose-700 border-rose-100';
  if (match?.matched && match?.matchType === 'exact') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (match?.matched) return 'bg-blue-50 text-blue-700 border-blue-100';
  if (match?.bestCandidate) return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function ProductTabsSyncPanel() {
  const [tabsForm, setTabsForm] = useState({
    wpUrl: localStorage.getItem('woo_wp_url') || localStorage.getItem('wp_url') || '',
    wooConsumerKey: localStorage.getItem('woo_consumer_key') || '',
    wooConsumerSecret: localStorage.getItem('woo_consumer_secret') || '',
    sheetUrl: localStorage.getItem('product_tabs_sheet_url') || DEFAULT_PRODUCT_TABS_SHEET_URL,
    minConfidence: Number(localStorage.getItem('product_tabs_min_confidence') || 0.82),
  });
  const [preview, setPreview] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [tabsError, setTabsError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  const updateTabsForm = (patch) => {
    setTabsForm((current) => ({ ...current, ...patch }));
    setPreview(null);
    setSyncResult(null);
  };

  const persistTabsForm = () => {
    localStorage.setItem('woo_wp_url', tabsForm.wpUrl);
    localStorage.setItem('woo_consumer_key', tabsForm.wooConsumerKey);
    localStorage.setItem('woo_consumer_secret', tabsForm.wooConsumerSecret);
    localStorage.setItem('product_tabs_sheet_url', tabsForm.sheetUrl);
    localStorage.setItem('product_tabs_min_confidence', String(tabsForm.minConfidence));
  };

  const buildTabsPayload = () => ({
    wpUrl: tabsForm.wpUrl,
    wooConsumerKey: tabsForm.wooConsumerKey,
    wooConsumerSecret: tabsForm.wooConsumerSecret,
    sheetUrl: tabsForm.sheetUrl,
    minConfidence: Number(tabsForm.minConfidence) || 0.82,
  });

  const handlePreviewTabs = async (event) => {
    event.preventDefault();
    setPreviewLoading(true);
    setTabsError('');
    setSyncResult(null);
    persistTabsForm();

    try {
      const result = await blogAPI.previewProductTabs(buildTabsPayload());
      setPreview(result);
    } catch (err) {
      setTabsError(normalizeErrorMessage(err.message, 'Không preview được sản phẩm WooCommerce'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSyncTabs = async () => {
    setSyncLoading(true);
    setTabsError('');
    persistTabsForm();

    try {
      const result = await blogAPI.syncProductTabs(buildTabsPayload());
      setSyncResult(result);
      setPreview(null);
    } catch (err) {
      setTabsError(normalizeErrorMessage(err.message, 'Không cập nhật được tab sản phẩm'));
    } finally {
      setSyncLoading(false);
    }
  };

  const rows = preview?.matches || syncResult?.results || [];
  const visibleRows = rows.slice(0, 12);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <Table size={18} className="text-blue-500" />
            Cập nhật tab sản phẩm WooCommerce
          </h2>
          <p className="mt-1 text-sm text-slate-500">Google Sheet sang meta tab Hướng dẫn sử dụng và Hướng dẫn bảo quản.</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
          Match bằng tên/SKU/slug
        </span>
      </div>

      <form onSubmit={handlePreviewTabs} className="space-y-4 p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="label">URL Website WordPress *</label>
            <input
              type="url"
              className="input"
              placeholder="https://paper.vn"
              value={tabsForm.wpUrl}
              onChange={(e) => updateTabsForm({ wpUrl: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Google Sheet URL *</label>
            <input
              type="url"
              className="input"
              value={tabsForm.sheetUrl}
              onChange={(e) => updateTabsForm({ sheetUrl: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_180px]">
          <div>
            <label className="label">WooCommerce Consumer Key *</label>
            <div className="relative">
              <KeyRound size={15} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
              <input
                type="password"
                className="input pl-9"
                placeholder="ck_..."
                value={tabsForm.wooConsumerKey}
                onChange={(e) => updateTabsForm({ wooConsumerKey: e.target.value })}
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
                value={tabsForm.wooConsumerSecret}
                onChange={(e) => updateTabsForm({ wooConsumerSecret: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Độ khớp tối thiểu</label>
            <input
              type="number"
              min="0.6"
              max="1"
              step="0.01"
              className="input"
              value={tabsForm.minConfidence}
              onChange={(e) => updateTabsForm({ minConfidence: e.target.value })}
            />
          </div>
        </div>

        {tabsError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            {tabsError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button type="submit" className="btn-outline" disabled={previewLoading || syncLoading}>
            {previewLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Preview match
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSyncTabs}
            disabled={syncLoading || previewLoading || !preview?.matchedCount}
          >
            {syncLoading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            Cập nhật tabs
          </button>
          {preview?.matchedCount > 0 && (
            <span className="text-sm text-slate-500">
              Sẽ cập nhật {preview.matchedCount}/{preview.totalRows} sản phẩm.
            </span>
          )}
        </div>
      </form>

      {(preview || syncResult) && (
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            {[
              { label: 'Dòng sheet', value: preview?.totalRows ?? syncResult?.totalRows },
              { label: preview ? 'Match được' : 'Đã cập nhật', value: preview?.matchedCount ?? syncResult?.updatedCount },
              { label: preview ? 'Bỏ qua' : 'Đã lưu meta', value: preview?.skippedCount ?? syncResult?.verifiedCount },
              { label: 'Lỗi', value: preview?.errorCount ?? syncResult?.errorCount },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{item.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">{item.value ?? 0}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <div className="min-w-[820px]">
              <div className="grid grid-cols-[72px_1.4fr_1.4fr_110px_120px] gap-3 border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Dòng</span>
                <span>Tên trong sheet</span>
                <span>Sản phẩm WP</span>
                <span>Độ khớp</span>
                <span>Trạng thái</span>
              </div>
              <div className="divide-y divide-slate-100">
                {visibleRows.map((row) => {
                  const product = row.product || row.bestCandidate;
                  const productHref = product?.editUrl || product?.permalink;
                  return (
                    <div key={`${row.rowNumber}-${row.productName}`} className="grid grid-cols-[72px_1.4fr_1.4fr_110px_120px] gap-3 px-4 py-3 text-sm">
                      <span className="text-slate-400">{row.sheetIndex || row.rowNumber}</span>
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
                        <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${matchClass(row)}`}>
                          {syncResult ? syncActionLabel(row) : matchLabel(row)}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {rows.length > visibleRows.length && (
            <p className="mt-3 text-xs text-slate-500">Đang hiển thị {visibleRows.length}/{rows.length} dòng đầu tiên.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function BlogWriter() {
  const [form, setForm] = useState({
    topic: '',
    keywords: [''],
    tone: 'professional',
    language: 'Vietnamese',
    wordCount: 1500,
    targetAudience: 'general',
    contentType: 'blog-post',
    includeImages: false,
  });
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [data, setData] = useState(null);
  const [streamContent, setStreamContent] = useState('');
  const [streamImage, setStreamImage] = useState(null);
  const [streamImageError, setStreamImageError] = useState('');
  const [streamStatus, setStreamStatus] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('content');
  const [titlesData, setTitlesData] = useState(null);

  // WordPress states
  const [showWpModal, setShowWpModal] = useState(false);
  const [wpForm, setWpForm] = useState({
    url: localStorage.getItem('wp_url') || '',
    username: localStorage.getItem('wp_username') || '',
    appPassword: localStorage.getItem('wp_app_password') || ''
  });
  const [wpPublishing, setWpPublishing] = useState(false);
  const [wpResult, setWpResult] = useState(null);
  const [wpError, setWpError] = useState('');

  const isProductArticle = form.contentType === 'product-post';
  const generatedImageSrc = imageToSrc(data?.featuredImage?.image);
  const streamImageSrc = imageToSrc(streamImage?.image);

  const composeContentWithImage = () => {
    const content = data?.content || streamContent;
    const figure = buildImageFigure(data?.featuredImage || streamImage);
    return `${figure}${content || ''}`;
  };

  const addKeyword = () => setForm({ ...form, keywords: [...form.keywords, ''] });
  const removeKeyword = (i) => setForm({ ...form, keywords: form.keywords.filter((_, idx) => idx !== i) });
  const updateKeyword = (i, val) => {
    const kws = [...form.keywords];
    kws[i] = val;
    setForm({ ...form, keywords: kws });
  };

  const downloadFeaturedImage = (featuredImage) => {
    const src = imageToSrc(featuredImage?.image);
    if (!src) return;

    if (src.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = src;
      link.download = featuredImage?.metadata?.fileName || 'featured-image.png';
      link.click();
      return;
    }

    window.open(src, '_blank', 'noopener,noreferrer');
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!form.topic.trim() || loading || streaming) return;
    setLoading(true);
    setError('');
    setData(null);
    setStreamContent('');
    setStreamImage(null);
    setStreamImageError('');
    setStreamStatus({
      status: 'content-queued',
      phase: 'content',
      message: 'Đang chuẩn bị viết bài',
      totalImages: form.includeImages ? 1 : 0,
    });
    const validKeywords = form.keywords.filter((k) => k.trim());

    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiBase}/api/blog/generate-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, keywords: validKeywords }),
      });

      if (!response.ok) {
        const text = await response.text();
        let message = text;

        try {
          message = JSON.parse(text).error || text;
        } catch {}

        throw new Error(normalizeErrorMessage(message, 'Không tạo được bài'));
      }

      if (!response.body) {
        throw new Error('Không nhận được dữ liệu stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastArticle = null;
      let fatalError = '';

      const handleGeneratePayload = (rawData) => {
        if (!rawData) return false;

        if (rawData === '[DONE]') {
          return true;
        }

        try {
          const parsed = JSON.parse(rawData);

          if (parsed.status) {
            setStreamStatus((current) => ({
              ...(current || {}),
              ...parsed,
            }));
          }

          if (parsed.status === 'error' && parsed.error) {
            fatalError = parsed.error;
            return true;
          }

          if (parsed.imageError) {
            setStreamImageError(parsed.imageError);
          }

          if (parsed.article) {
            lastArticle = parsed.article;
            setData(parsed.article);
            setActiveTab('content');
          }
        } catch {}

        return false;
      };

      const processBuffer = () => {
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || '';

        for (const event of events) {
          const eventData = event
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data: '))
            .map((line) => line.slice(6))
            .join('\n')
            .trim();

          if (handleGeneratePayload(eventData)) return true;
        }

        return false;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          processBuffer();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        if (processBuffer()) break;
      }

      if (fatalError) {
        throw new Error(normalizeErrorMessage(fatalError));
      }

      if (!lastArticle) {
        throw new Error('AI chưa trả về dữ liệu bài viết hoàn chỉnh');
      }
    } catch (err) {
      setError(normalizeErrorMessage(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleStream = async () => {
    if (!form.topic.trim()) return;
    setStreaming(true);
    setStreamContent('');
    setStreamImage(null);
    setStreamImageError('');
    setStreamStatus({
      status: 'content-queued',
      phase: 'content',
      message: 'Đang kết nối tới AI',
      totalImages: form.includeImages ? 1 : 0,
    });
    setData(null);
    setError('');
    const validKeywords = form.keywords.filter((k) => k.trim());

    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiBase}/api/blog/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, keywords: validKeywords }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Không viết được bài');
      }

      if (!response.body) {
        throw new Error('Không nhận được dữ liệu stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let content = '';
      let buffer = '';

      const handleStreamPayload = (rawData) => {
        if (!rawData) return false;

        if (rawData === '[DONE]') {
          setStreaming(false);
          setStreamStatus((current) => ({
            ...(current || {}),
            status: current?.status === 'image-error' ? 'image-error' : 'done',
            message: current?.status === 'image-error' ? current.message : 'Hoàn tất',
          }));
          return true;
        }

        try {
          const parsed = JSON.parse(rawData);

          if (parsed.status) {
            setStreamStatus((current) => ({
              ...(current || {}),
              ...parsed,
            }));
          }

          if (parsed.image) {
            setStreamImage(parsed.image);
            setStreamStatus((current) => ({
              ...(current || {}),
              status: 'image-complete',
              phase: 'image',
              message: current?.message || 'Đã tạo xong ảnh 1/1',
              imageIndex: current?.imageIndex || 1,
              totalImages: current?.totalImages || 1,
            }));
          }

          if (parsed.imageError) {
            setStreamImageError(parsed.imageError);
            setStreamStatus((current) => ({
              ...(current || {}),
              status: 'image-error',
              phase: 'image',
              message: parsed.message || 'Không tạo được ảnh',
              imageIndex: parsed.imageIndex || current?.imageIndex || 1,
              totalImages: parsed.totalImages || current?.totalImages || 1,
            }));
          }

          if (parsed.content) {
            content += parsed.content;
            // Strip markdown code fences if AI wraps HTML in ```html ... ```
            const cleaned = content.replace(/^```html\s*/i, '').replace(/```\s*$/, '');
            setStreamContent(cleaned);
          }
        } catch {}

        return false;
      };

      const processBuffer = () => {
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || '';

        for (const event of events) {
          const data = event
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data: '))
            .map((line) => line.slice(6))
            .join('\n')
            .trim();

          if (handleStreamPayload(data)) return true;
        }

        return false;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          processBuffer();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        if (processBuffer()) return;
      }
    } catch (err) {
      setError(normalizeErrorMessage(err.message));
    } finally {
      setStreaming(false);
    }
  };

  const handleTitles = async () => {
    if (!form.topic.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await blogAPI.titles({
        topic: form.topic,
        keyword: form.keywords[0],
        contentType: form.contentType,
        count: 10,
      });
      setTitlesData(result);
      setActiveTab('titles');
    } catch (err) {
      setError(normalizeErrorMessage(err.message));
    } finally {
      setLoading(false);
    }
  };

  const copyContent = async () => {
    const text = composeContentWithImage();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadHTML = () => {
    const content = composeContentWithImage();
    if (!content) return;
    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${data?.title || form.topic}</title>
  <meta name="description" content="${data?.metaDescription || ''}">
</head>
<body>
  <h1>${data?.title || form.topic}</h1>
  ${content}
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.topic.slice(0, 30).replace(/\s+/g, '-')}.html`;
    a.click();
  };

  const handleWpPublish = async (e) => {
    e.preventDefault();
    setWpPublishing(true);
    setWpError('');
    setWpResult(null);

    localStorage.setItem('wp_url', wpForm.url);
    localStorage.setItem('wp_username', wpForm.username);
    localStorage.setItem('wp_app_password', wpForm.appPassword);

    try {
      const content = composeContentWithImage();
      const title = data?.title || form.topic;
      
      const result = await blogAPI.publishWordPress({
        wpUrl: wpForm.url,
        wpUsername: wpForm.username,
        wpAppPassword: wpForm.appPassword,
        title,
        content,
        status: 'draft'
      });
      
      setWpResult(result);
    } catch (err) {
      setWpError(normalizeErrorMessage(err.message, 'Lỗi khi đăng bài lên WordPress'));
    } finally {
      setWpPublishing(false);
    }
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <PenTool size={24} className="text-pink-500" />
          AI Content Writer
        </h1>
        <p className="text-slate-500 text-sm mt-1">Viết blog và bài sản phẩm SEO bằng cx/gpt-5.5</p>
      </div>

      <div className="card p-5">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="label">Loại bài viết</label>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              {contentTypes.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, contentType: value })}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                    form.contentType === value
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">{isProductArticle ? 'Tên sản phẩm / chủ đề sản phẩm *' : 'Chủ đề bài viết *'}</label>
            <input
              type="text"
              className="input"
              placeholder={isProductArticle
                ? 'vd: Máy lọc không khí thông minh cho căn hộ nhỏ'
                : 'vd: Hướng dẫn SEO cho người mới bắt đầu'}
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">Từ khóa mục tiêu</label>
            <div className="space-y-2">
              {form.keywords.map((kw, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder={i === 0 ? 'Từ khóa chính...' : 'Từ khóa phụ...'}
                    value={kw}
                    onChange={(e) => updateKeyword(i, e.target.value)}
                  />
                  {form.keywords.length > 1 && (
                    <button type="button" onClick={() => removeKeyword(i)} className="p-2 text-slate-400 hover:text-red-500">
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              {form.keywords.length < 6 && (
                <button type="button" onClick={addKeyword} className="text-sm text-primary-600 flex items-center gap-1">
                  <Plus size={14} />
                  Thêm từ khóa
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Giọng văn</label>
              <select className="input" value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}>
                <option value="professional">Chuyên nghiệp</option>
                <option value="friendly">Thân thiện</option>
                <option value="educational">Giáo dục</option>
                <option value="conversational">Gần gũi</option>
                <option value="authoritative">Chuyên gia</option>
              </select>
            </div>
            <div>
              <label className="label">Ngôn ngữ</label>
              <select className="input" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                <option value="Vietnamese">Tiếng Việt</option>
                <option value="English">English</option>
              </select>
            </div>
            <div>
              <label className="label">Số từ</label>
              <select className="input" value={form.wordCount} onChange={(e) => setForm({ ...form, wordCount: +e.target.value })}>
                <option value={800}>~800 từ (Short)</option>
                <option value={1200}>~1200 từ</option>
                <option value={1500}>~1500 từ</option>
                <option value={2000}>~2000 từ</option>
                <option value={2500}>~2500 từ (Long)</option>
              </select>
            </div>
            <div>
              <label className="label">Đối tượng</label>
              <select className="input" value={form.targetAudience} onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}>
                <option value="general">Đại chúng</option>
                <option value="beginners">Người mới</option>
                <option value="intermediate">Trung cấp</option>
                <option value="experts">Chuyên gia</option>
                <option value="business">Doanh nghiệp</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.includeImages}
              onChange={(e) => setForm({ ...form, includeImages: e.target.checked })}
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <ImageIcon size={16} />
            </span>
            <span>
              <span className="block font-semibold">Viết kèm hình ảnh</span>
              <span className="block text-xs text-slate-500">Sinh ảnh featured bằng cx/gpt-5.4-image</span>
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={loading || streaming}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading
                ? form.includeImages ? 'Đang tạo bài và ảnh...' : 'Đang tạo bài...'
                : isProductArticle ? 'Tạo bài sản phẩm' : 'Tạo bài blog'}
            </button>
            <button
              type="button"
              onClick={handleStream}
              className="btn-secondary"
              disabled={loading || streaming}
            >
              {streaming ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              {streaming
                ? form.includeImages ? 'Đang viết và tạo ảnh...' : 'Đang viết...'
                : 'Viết trực tiếp (Stream)'}
            </button>
            <button
              type="button"
              onClick={handleTitles}
              className="btn-outline"
              disabled={loading || streaming}
            >
              <RefreshCw size={16} />
              Gợi ý tiêu đề
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          <strong>Lỗi:</strong> {error}
        </div>
      )}

      {/* Stream output */}
      {((loading && streamStatus) || streaming || streamContent) && !data && (
        <>
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Wand2 size={16} className="text-pink-500" />
                Nội dung đang tạo
                {(loading || streaming) && (
                  <span className="flex gap-1 ml-2">
                    <span className="typing-dot text-primary-500" />
                    <span className="typing-dot text-primary-500" />
                    <span className="typing-dot text-primary-500" />
                  </span>
                )}
              </h3>
              {streamContent && (
                <div className="flex gap-2">
                  <button onClick={() => setShowWpModal(true)} className="btn-outline text-xs">
                    <Globe size={12} />
                    Đăng WordPress
                  </button>
                  <button onClick={copyContent} className="btn-outline text-xs">
                    {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
                    {copied ? 'Đã copy' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
            <StreamProgressPanel
              progress={streamStatus}
              includeImages={form.includeImages}
              hasContent={Boolean(streamContent)}
              imageSrc={streamImageSrc}
              imageError={streamImageError}
            />
            <div
              className="prose-content text-sm text-slate-700 leading-relaxed min-h-20"
              dangerouslySetInnerHTML={{ __html: streamContent || '<p class="text-slate-400 italic">Đang khởi tạo...</p>' }}
            />
          </div>
          <FeaturedImageCard
            featuredImage={streamImage}
            imageError={streamImageError}
            imageSrc={streamImageSrc}
            status={streamStatus?.phase === 'image' ? streamStatus : null}
            onDownload={() => downloadFeaturedImage(streamImage)}
          />
        </>
      )}

      {/* Full article data */}
      {data && !loading && (
        <>
          {/* Article header */}
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-slate-800 mb-1">{data.title}</h2>
                <p className="text-slate-500 text-sm">{data.metaDescription}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowWpModal(true)} className="btn-outline text-sm">
                  <Globe size={14} />
                  Đăng WordPress
                </button>
                <button onClick={copyContent} className="btn-outline text-sm">
                  {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                  {copied ? 'Đã copy' : 'Copy HTML'}
                </button>
                <button onClick={downloadHTML} className="btn-primary text-sm">
                  <Download size={14} />
                  Download
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.readingTime && (
                <span className="badge badge-blue flex items-center gap-1">
                  <Clock size={10} /> {data.readingTime}
                </span>
              )}
              {data.wordCount && (
                <span className="badge badge-purple flex items-center gap-1">
                  <BookOpen size={10} /> {data.wordCount?.toLocaleString()} từ
                </span>
              )}
              {data.focusKeyword && (
                <span className="badge badge-green flex items-center gap-1">
                  <Tag size={10} /> {data.focusKeyword}
                </span>
              )}
              {data.tags?.map((tag, i) => (
                <span key={i} className="badge badge-yellow">{tag}</span>
              ))}
            </div>
          </div>

          <FeaturedImageCard
            featuredImage={data.featuredImage}
            imageError={data.imageError}
            imageSrc={generatedImageSrc}
            onDownload={() => downloadFeaturedImage(data.featuredImage)}
          />

          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit overflow-x-auto">
            {[
              { key: 'content', label: 'Nội dung' },
              { key: 'meta', label: 'Meta & SEO' },
              { key: 'outline', label: 'Outline' },
              { key: 'faq', label: 'FAQ' },
              { key: 'schema', label: 'Schema' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === key ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'content' && (
            <div className="card p-6">
              <div className="prose-content" dangerouslySetInnerHTML={{ __html: data.content }} />
            </div>
          )}

          {activeTab === 'meta' && (
            <div className="space-y-4">
              <div className="card p-5">
                <h3 className="font-semibold text-slate-800 mb-4">SEO Meta Tags</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Title', value: data.title, max: 60 },
                    { label: 'Meta Description', value: data.metaDescription, max: 160 },
                    { label: 'Slug / URL', value: data.slug },
                    { label: 'Focus Keyword', value: data.focusKeyword },
                  ].map(({ label, value, max }) => (
                    <div key={label}>
                      <div className="text-sm font-medium text-slate-500 mb-1">{label}</div>
                      <div className="flex items-start gap-2">
                        <div className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono break-all">
                          {value}
                        </div>
                        <button
                          onClick={() => navigator.clipboard.writeText(value || '')}
                          className="p-2 text-slate-400 hover:text-slate-600 flex-shrink-0"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                      {max && value && (
                        <div className={`text-xs mt-0.5 ${value.length > max ? 'text-red-500' : 'text-slate-400'}`}>
                          {value.length}/{max} ký tự
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {data.featuredImage?.metadata && (
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-800 mb-3">Featured Image SEO</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Alt text', value: data.featuredImage.metadata.altText },
                      { label: 'File name', value: data.featuredImage.metadata.fileName },
                      { label: 'Caption', value: data.featuredImage.metadata.caption },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div className="text-sm font-medium text-slate-500 mb-1">{label}</div>
                        <div className="flex items-start gap-2">
                          <div className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 break-words">
                            {value}
                          </div>
                          <button
                            onClick={() => navigator.clipboard.writeText(value || '')}
                            className="p-2 text-slate-400 hover:text-slate-600 flex-shrink-0"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.secondaryKeywords?.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-800 mb-3">Secondary Keywords</h3>
                  <div className="flex flex-wrap gap-2">
                    {data.secondaryKeywords.map((kw, i) => (
                      <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm border border-indigo-200">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {data.seoTips?.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-800 mb-3">SEO Tips</h3>
                  <ul className="space-y-2">
                    {data.seoTips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <CheckCircle size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'outline' && data.outline && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Cấu trúc bài viết</h3>
              <div className="space-y-2">
                {data.outline.map((item, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl text-sm ${
                      item.type === 'h1' ? 'bg-indigo-100 font-bold text-indigo-800' :
                      item.type === 'h2' ? 'bg-blue-50 font-semibold text-blue-800 ml-3' :
                      'bg-slate-50 text-slate-700 ml-6'
                    }`}
                  >
                    {item.heading}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'faq' && data.faq && (
            <div className="space-y-3">
              {data.faq.map((item, i) => (
                <div key={i} className="card p-5">
                  <div className="font-semibold text-slate-800 mb-2">Q: {item.question}</div>
                  <p className="text-sm text-slate-600 leading-relaxed">A: {item.answer}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'schema' && data.schemaMarkup && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800">Schema Markup (JSON-LD)</h3>
                <button
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(data.schemaMarkup, null, 2))}
                  className="btn-outline text-xs"
                >
                  <Copy size={12} />
                  Copy
                </button>
              </div>
              <pre className="bg-slate-900 text-green-400 rounded-xl p-4 text-xs overflow-auto">
                {JSON.stringify(data.schemaMarkup, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}

      {/* Title suggestions */}
      {titlesData && activeTab === 'titles' && (
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">Gợi ý tiêu đề ({titlesData.titles?.length})</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {titlesData.titles?.map((t, i) => (
              <div key={i} className="p-4 hover:bg-slate-50 flex items-start gap-3">
                <div className="flex-1">
                  <div
                    className="font-medium text-slate-800 cursor-pointer hover:text-primary-600 transition-colors"
                    onClick={() => {
                      setForm({ ...form, topic: t.title });
                      setTitlesData(null);
                      setActiveTab('content');
                    }}
                  >
                    {t.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="badge badge-blue">{t.type}</span>
                    <span className={`text-xs ${t.title?.length > 60 ? 'text-red-500' : 'text-slate-400'}`}>
                      {t.title?.length} ký tự
                    </span>
                    {t.powerWord && <span className="badge badge-purple">{t.powerWord}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-slate-400">SEO</div>
                  <div className={`font-bold text-sm ${t.seoScore >= 8 ? 'text-green-600' : t.seoScore >= 6 ? 'text-amber-500' : 'text-red-500'}`}>
                    {t.seoScore}/10
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WordPress Publish Modal */}
      {showWpModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fadeIn">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Globe className="text-blue-500" size={20} />
                Đăng lên WordPress (Bản nháp)
              </h3>
              <button onClick={() => setShowWpModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5">
              {wpResult ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle size={32} />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-800">Đăng bài thành công!</h4>
                    <p className="text-slate-500 text-sm mt-1">Bài viết đã được lưu dưới dạng bản nháp.</p>
                  </div>
                  <div className="flex gap-3 justify-center mt-6">
                    <a href={wpResult.editUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
                      Xem & Chỉnh sửa trên WP
                    </a>
                    <button onClick={() => { setShowWpModal(false); setWpResult(null); }} className="btn-outline">
                      Đóng
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleWpPublish} className="space-y-4">
                  <div>
                    <label className="label">URL Website WordPress *</label>
                    <input
                      type="url"
                      className="input"
                      placeholder="https://yoursite.com"
                      value={wpForm.url}
                      onChange={(e) => setWpForm({ ...wpForm, url: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Tên đăng nhập / Email *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="admin"
                      value={wpForm.username}
                      onChange={(e) => setWpForm({ ...wpForm, username: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">
                      Application Password *
                      <a href="https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 ml-2 font-normal hover:underline">
                        (Cách tạo)
                      </a>
                    </label>
                    <input
                      type="password"
                      className="input"
                      placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                      value={wpForm.appPassword}
                      onChange={(e) => setWpForm({ ...wpForm, appPassword: e.target.value })}
                      required
                    />
                    <p className="text-xs text-slate-500 mt-1">Sử dụng Application Password thay vì mật khẩu thông thường để đảm bảo bảo mật.</p>
                  </div>
                  
                  {wpError && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                      {wpError}
                    </div>
                  )}
                  
                  <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                    <button type="button" onClick={() => setShowWpModal(false)} className="btn-outline">
                      Hủy
                    </button>
                    <button type="submit" disabled={wpPublishing} className="btn-primary">
                      {wpPublishing ? (
                        <><Loader2 size={16} className="animate-spin" /> Đang đăng...</>
                      ) : (
                        <><Send size={16} /> Đăng Bản Nháp</>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
