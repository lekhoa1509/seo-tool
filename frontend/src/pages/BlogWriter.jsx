import React, { useState, useRef } from 'react';
import {
  PenTool, Loader2, Plus, X, Copy, Download, Sparkles,
  RefreshCw, CheckCircle, Tag, Clock, BookOpen, Wand2, Globe, Send
} from 'lucide-react';
import { blogAPI } from '../utils/api';

export default function BlogWriter() {
  const [form, setForm] = useState({
    topic: '',
    keywords: [''],
    tone: 'professional',
    language: 'Vietnamese',
    wordCount: 1500,
    targetAudience: 'general',
    contentType: 'blog-post',
  });
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [data, setData] = useState(null);
  const [streamContent, setStreamContent] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('content');
  const [titlesData, setTitlesData] = useState(null);
  const contentRef = useRef(null);

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

  const addKeyword = () => setForm({ ...form, keywords: [...form.keywords, ''] });
  const removeKeyword = (i) => setForm({ ...form, keywords: form.keywords.filter((_, idx) => idx !== i) });
  const updateKeyword = (i, val) => {
    const kws = [...form.keywords];
    kws[i] = val;
    setForm({ ...form, keywords: kws });
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!form.topic.trim()) return;
    setLoading(true);
    setError('');
    setData(null);
    setStreamContent('');
    const validKeywords = form.keywords.filter((k) => k.trim());
    try {
      const result = await blogAPI.generate({ ...form, keywords: validKeywords });
      setData(result);
      setActiveTab('content');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStream = async () => {
    if (!form.topic.trim()) return;
    setStreaming(true);
    setStreamContent('');
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

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let content = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setStreaming(false);
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                content += parsed.content;
                // Strip markdown code fences if AI wraps HTML in ```html ... ```
                const cleaned = content.replace(/^```html\s*/i, '').replace(/```\s*$/, '');
                setStreamContent(cleaned);
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setError(err.message);
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
        count: 10,
      });
      setTitlesData(result);
      setActiveTab('titles');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyContent = async () => {
    const text = data?.content || streamContent;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadHTML = () => {
    const content = data?.content || streamContent;
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
      const content = data?.content || streamContent;
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
      setWpError(err.message || 'Lỗi khi đăng bài lên WordPress');
    } finally {
      setWpPublishing(false);
    }
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <PenTool size={24} className="text-pink-500" />
          AI Blog Writer
        </h1>
        <p className="text-slate-500 text-sm mt-1">Viết bài blog SEO chuẩn với GPT-4.1 Mini</p>
      </div>

      <div className="card p-5">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="label">Chủ đề bài viết *</label>
            <input
              type="text"
              className="input"
              placeholder="vd: Hướng dẫn SEO cho người mới bắt đầu năm 2024"
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

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={loading || streaming}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? 'Đang tạo bài...' : 'Tạo bài hoàn chỉnh'}
            </button>
            <button
              type="button"
              onClick={handleStream}
              className="btn-secondary"
              disabled={loading || streaming}
            >
              {streaming ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              {streaming ? 'Đang viết...' : 'Viết trực tiếp (Stream)'}
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
      {(streaming || streamContent) && !data && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Wand2 size={16} className="text-pink-500" />
              Nội dung đang tạo
              {streaming && (
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
          <div
            className="prose-content text-sm text-slate-700 leading-relaxed min-h-20"
            dangerouslySetInnerHTML={{ __html: streamContent || '<p class="text-slate-400 italic">Đang khởi tạo...</p>' }}
          />
        </div>
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
