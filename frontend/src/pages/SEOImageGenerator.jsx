import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  Layers,
  Loader2,
  Palette,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import { imageAPI } from '../utils/api';

const imageTypes = [
  ['blog hero image', 'Blog hero'],
  ['featured image', 'Featured image'],
  ['social preview image', 'Social preview'],
  ['infographic style visual', 'Infographic'],
  ['landing page hero visual', 'Landing hero'],
];

const styles = [
  ['modern editorial illustration', 'Editorial'],
  ['clean SaaS product visual', 'SaaS'],
  ['premium 3D marketing render', '3D'],
  ['minimal flat vector style', 'Flat'],
  ['realistic office photography style', 'Photo'],
];

const aspectRatios = [
  ['16:9', '16:9'],
  ['4:3', '4:3'],
  ['1:1', '1:1'],
  ['9:16', '9:16'],
];

function imageToSrc(image, outputFormat) {
  if (!image) return '';
  if (image.url) return image.url;
  if (!image.b64_json) return '';
  if (image.b64_json.startsWith('data:')) return image.b64_json;
  return `data:image/${outputFormat};base64,${image.b64_json}`;
}

export default function SEOImageGenerator() {
  const [mode, setMode] = useState('generate');
  const [form, setForm] = useState({
    topic: '',
    keyword: '',
    imageType: 'blog hero image',
    style: 'modern editorial illustration',
    audience: 'business readers',
    brandColors: 'blue, green, white, warm yellow accent',
    mood: 'trustworthy, sharp, professional',
    aspectRatio: '16:9',
    includeText: false,
    customPrompt: '',
    size: 'auto',
    quality: 'auto',
    background: 'auto',
    imageDetail: 'high',
    outputFormat: 'png',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState('');

  const imageSrc = useMemo(
    () => imageToSrc(result?.image, form.outputFormat),
    [result, form.outputFormat]
  );

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const canSubmit = mode === 'generate'
    ? form.topic.trim()
    : uploadFile && form.customPrompt.trim();

  const copyText = async (key, text) => {
    await navigator.clipboard.writeText(text || '');
    setCopied(key);
    setTimeout(() => setCopied(''), 1800);
  };

  const handleGenerate = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError('');

    try {
      let data;

      if (mode === 'edit') {
        const body = new FormData();
        body.append('image', uploadFile);

        Object.entries({
          ...form,
          topic: form.topic.trim() || 'SEO image edit',
          keyword: form.keyword.trim(),
        }).forEach(([key, value]) => {
          body.append(key, String(value ?? ''));
        });

        body.append('editPrompt', form.customPrompt.trim());
        data = await imageAPI.editSeo(body);
      } else {
        data = await imageAPI.generateSeo({
          ...form,
          topic: form.topic.trim(),
          keyword: form.keyword.trim(),
        });
      }

      setResult(data);
    } catch (err) {
      setError(err.message || 'Không tạo được ảnh SEO');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    setUploadFile(file || null);
    setResult(null);

    if (!file) {
      setUploadPreview('');
      return;
    }

    setUploadPreview(URL.createObjectURL(file));
  };

  const downloadImage = async () => {
    if (!imageSrc) return;

    if (imageSrc.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = imageSrc;
      link.download = result?.metadata?.fileName || `seo-image.${form.outputFormat}`;
      link.click();
      return;
    }

    window.open(imageSrc, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ImageIcon size={24} className="text-teal-500" />
            Tạo ảnh SEO
          </h1>
          <p className="text-slate-500 text-sm mt-1">Tạo mới hoặc upload ảnh để ghép/chỉnh theo prompt bằng cx/gpt-5.4-image</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700">
          <Sparkles size={15} />
          Image AI
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Lỗi:</strong> {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
        <form onSubmit={handleGenerate} className="card p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            {[
              ['generate', ImageIcon, 'Tạo mới'],
              ['edit', Layers, 'Ghép ảnh'],
            ].map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMode(key);
                  setError('');
                  setResult(null);
                }}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                  mode === key
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          {mode === 'edit' && (
            <div>
              <label className="label">Upload ảnh gốc *</label>
              <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition-colors hover:border-teal-300 hover:bg-teal-50">
                {uploadPreview ? (
                  <img src={uploadPreview} alt="Ảnh upload" className="max-h-48 rounded-lg object-contain" />
                ) : (
                  <>
                    <Upload size={28} className="text-slate-400" />
                    <span className="mt-2 text-sm font-semibold text-slate-700">Chọn ảnh để ghép/chỉnh</span>
                    <span className="mt-1 text-xs text-slate-400">PNG, JPG, WebP tối đa 12MB</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              {uploadFile && (
                <div className="mt-2 text-xs text-slate-500">
                  {uploadFile.name} - {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                </div>
              )}
            </div>
          )}

          <div>
            <label className="label">{mode === 'edit' ? 'Chủ đề SEO' : 'Chủ đề ảnh *'}</label>
            <input
              className="input"
              value={form.topic}
              onChange={(event) => updateForm('topic', event.target.value)}
              placeholder="vd: Chiến lược SEO tổng thể cho website B2B"
              required={mode === 'generate'}
            />
          </div>

          <div>
            <label className="label">Từ khóa chính</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                className="input pl-9"
                value={form.keyword}
                onChange={(event) => updateForm('keyword', event.target.value)}
                placeholder="vd: dịch vụ SEO tổng thể"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Loại ảnh</label>
              <select
                className="input"
                value={form.imageType}
                onChange={(event) => updateForm('imageType', event.target.value)}
              >
                {imageTypes.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Tỷ lệ</label>
              <select
                className="input"
                value={form.aspectRatio}
                onChange={(event) => updateForm('aspectRatio', event.target.value)}
              >
                {aspectRatios.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Phong cách</label>
            <div className="grid grid-cols-2 gap-2">
              {styles.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateForm('style', value)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
                    form.style === value
                      ? 'border-teal-200 bg-teal-50 text-teal-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Màu thương hiệu</label>
            <div className="relative">
              <Palette size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                className="input pl-9"
                value={form.brandColors}
                onChange={(event) => updateForm('brandColors', event.target.value)}
                placeholder="blue, green, white..."
              />
            </div>
          </div>

          <div>
            <label className="label">{mode === 'edit' ? 'Prompt ghép/chỉnh ảnh *' : 'Prompt bổ sung'}</label>
            <textarea
              className="textarea min-h-24"
              value={form.customPrompt}
              onChange={(event) => updateForm('customPrompt', event.target.value)}
              placeholder={mode === 'edit'
                ? 'vd: giữ nhân vật chính, thêm dashboard SEO phía sau, ánh sáng chuyên nghiệp, màu xanh thương hiệu...'
                : 'vd: thêm dashboard analytics, backlink graph, nội dung đang tăng trưởng...'}
              required={mode === 'edit'}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.includeText}
                onChange={(event) => updateForm('includeText', event.target.checked)}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              Cho phép chữ
            </label>
            <select
              className="input"
              value={form.imageDetail}
              onChange={(event) => updateForm('imageDetail', event.target.value)}
            >
              <option value="high">Detail high</option>
              <option value="auto">Detail auto</option>
              <option value="low">Detail low</option>
            </select>
          </div>

          <button type="submit" disabled={loading || !canSubmit} className="btn-primary w-full justify-center">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {loading ? 'Đang xử lý ảnh...' : mode === 'edit' ? 'Ghép ảnh theo prompt' : 'Tạo ảnh SEO'}
          </button>
        </form>

        <div className="space-y-5">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-800">Preview</h2>
                <p className="text-xs text-slate-500 mt-0.5">Model: cx/gpt-5.4-image</p>
              </div>
              {result && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => setResult(null)} className="btn-outline text-sm">
                    <RefreshCw size={14} />
                    Xóa
                  </button>
                  <button type="button" onClick={downloadImage} className="btn-primary text-sm">
                    <Download size={14} />
                    Download
                  </button>
                </div>
              )}
            </div>

            <div className="bg-slate-100 p-4 sm:p-6">
              <div className="aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-white flex items-center justify-center">
                {loading ? (
                  <div className="flex flex-col items-center gap-3 text-slate-500">
                    <Loader2 size={28} className="animate-spin text-teal-500" />
                    <span className="text-sm font-medium">Đang render visual...</span>
                  </div>
                ) : imageSrc ? (
                  <img src={imageSrc} alt={result?.metadata?.altText || form.topic} className="h-full w-full object-contain" />
                ) : mode === 'edit' && uploadPreview ? (
                  <div className="relative h-full w-full">
                    <img src={uploadPreview} alt="Ảnh gốc" className="h-full w-full object-contain opacity-80" />
                    <div className="absolute bottom-3 left-3 rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-white">
                      Ảnh gốc đang chờ ghép
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-400">
                    <ImageIcon size={36} />
                    <span className="text-sm">Ảnh SEO sẽ xuất hiện ở đây</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {result && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="card p-5 space-y-3">
                <h3 className="font-semibold text-slate-800">SEO Metadata</h3>
                {[
                  ['alt', 'Alt text', result.metadata?.altText],
                  ['file', 'File name', result.metadata?.fileName],
                  ['caption', 'Caption', result.metadata?.caption],
                ].map(([key, label, value]) => (
                  <div key={key}>
                    <div className="text-xs font-semibold text-slate-500 mb-1">{label}</div>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 break-words">
                        {value}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(key, value)}
                        className="p-2 text-slate-400 hover:text-slate-600"
                      >
                        {copied === key ? <Check size={15} /> : <Copy size={15} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="card p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="font-semibold text-slate-800">Prompt đã gửi</h3>
                  <button
                    type="button"
                    onClick={() => copyText('prompt', result.prompt)}
                    className="btn-outline text-xs"
                  >
                    {copied === 'prompt' ? <Check size={12} /> : <Copy size={12} />}
                    {copied === 'prompt' ? 'Đã copy' : 'Copy'}
                  </button>
                </div>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
                  {result.prompt}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
