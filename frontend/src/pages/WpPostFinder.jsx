import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle,
  ExternalLink,
  FileSearch,
  Hash,
  KeyRound,
  Loader2,
  Search,
} from 'lucide-react';
import { wpPostFinderAPI } from '../utils/api';

const DEFAULT_PHRASE = 'tốt nhất';

const STATUS_OPTIONS = [
  { value: 'publish', label: 'Đã xuất bản' },
  { value: 'any', label: 'Tất cả' },
  { value: 'draft', label: 'Bản nháp' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'private', label: 'Riêng tư' },
  { value: 'future', label: 'Đã lên lịch' },
];

function normalizeErrorMessage(message, fallback = 'Có lỗi xảy ra') {
  return String(message || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || fallback;
}

function statusClass(status) {
  if (status === 'publish') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (status === 'draft') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (status === 'pending') return 'bg-blue-50 text-blue-700 border-blue-100';
  if (status === 'private') return 'bg-violet-50 text-violet-700 border-violet-100';
  if (status === 'future') return 'bg-cyan-50 text-cyan-700 border-cyan-100';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function statusLabel(status) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label || status || '-';
}

function formatDate(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).replace('T', ' ');
  return parsed.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WpPostFinder() {
  const [form, setForm] = useState({
    wpUrl: localStorage.getItem('woo_wp_url') || localStorage.getItem('wp_url') || '',
    wpUsername: localStorage.getItem('wp_username') || '',
    wpAppPassword: localStorage.getItem('wp_app_password') || '',
    phrase: localStorage.getItem('wp_post_finder_phrase') || DEFAULT_PHRASE,
    maxItems: Number(localStorage.getItem('wp_post_finder_max_items') || 500),
    status: localStorage.getItem('wp_post_finder_status') || 'publish',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const results = result?.results || [];
  const statCards = useMemo(() => [
    { label: 'Đã quét', value: result?.totalScanned },
    { label: 'Khớp H1', value: result?.matchedCount },
    { label: 'Khớp tiêu đề', value: result?.titleMatchCount },
    { label: 'Khớp content H1', value: result?.contentH1MatchCount },
  ], [result]);

  const persistForm = () => {
    localStorage.setItem('wp_url', form.wpUrl);
    localStorage.setItem('woo_wp_url', form.wpUrl);
    localStorage.setItem('wp_username', form.wpUsername);
    localStorage.setItem('wp_app_password', form.wpAppPassword);
    localStorage.setItem('wp_post_finder_phrase', form.phrase);
    localStorage.setItem('wp_post_finder_max_items', String(form.maxItems));
    localStorage.setItem('wp_post_finder_status', form.status);
  };

  const buildPayload = () => ({
    ...form,
    maxItems: Number(form.maxItems) || 500,
  });

  const searchPosts = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    persistForm();

    try {
      const searchResult = await wpPostFinderAPI.search(buildPayload());
      setResult(searchResult);
    } catch (err) {
      setError(normalizeErrorMessage(err.message, 'Không tìm được bài viết WordPress'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <FileSearch size={24} className="text-rose-500" />
          Tìm bài viết WP
        </h1>
      </div>

      <form onSubmit={searchPosts} className="card p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="label">URL Website WordPress *</label>
            <input
              type="url"
              className="input"
              placeholder="https://thegioigiay.net"
              value={form.wpUrl}
              onChange={(event) => setForm({ ...form, wpUrl: event.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Cụm từ trong H1 *</label>
            <div className="relative">
              <Hash size={15} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                className="input pl-9"
                value={form.phrase}
                onChange={(event) => setForm({ ...form, phrase: event.target.value })}
                required
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <label className="label">WordPress Username</label>
            <div className="relative">
              <KeyRound size={15} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                className="input pl-9"
                value={form.wpUsername}
                onChange={(event) => setForm({ ...form, wpUsername: event.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">WordPress Application Password</label>
            <div className="relative">
              <KeyRound size={15} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
              <input
                type="password"
                className="input pl-9"
                value={form.wpAppPassword}
                onChange={(event) => setForm({ ...form, wpAppPassword: event.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <label className="label">Trạng thái bài viết</label>
            <select
              className="input"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Số bài tối đa</label>
            <input
              type="number"
              min="1"
              max="2000"
              className="input"
              value={form.maxItems}
              onChange={(event) => setForm({ ...form, maxItems: event.target.value })}
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Tìm bài viết
          </button>
        </div>
      </form>

      {result && (
        <div className="card overflow-hidden">
          <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-5 md:grid-cols-4">
            {statCards.map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{item.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">{item.value ?? 0}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-700">
            <CheckCircle size={16} />
            Tìm thấy {result.matchedCount} bài có H1 chứa "{result.phrase}".
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[1.35fr_1.15fr_150px_130px_150px_110px] gap-3 border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Tiêu đề</span>
                <span>H1 khớp</span>
                <span>Nguồn</span>
                <span>Trạng thái</span>
                <span>Cập nhật</span>
                <span>Link</span>
              </div>

              <div className="divide-y divide-slate-100">
                {!results.length && (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">
                    Không tìm thấy bài viết có H1 chứa "{result.phrase}".
                  </div>
                )}

                {results.map((item) => (
                  <div key={item.id} className="grid grid-cols-[1.35fr_1.15fr_150px_130px_150px_110px] gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0 break-words font-medium text-slate-800">{item.title}</span>
                    <span className="line-clamp-4 whitespace-pre-line text-xs leading-relaxed text-slate-500">
                      {item.matches?.map((match) => match.text).join('\n') || item.matchedH1}
                    </span>
                    <span className="flex flex-wrap items-start gap-1">
                      {(item.matchSources || []).map((source) => (
                        <span key={source} className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                          {source}
                        </span>
                      ))}
                    </span>
                    <span>
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </span>
                    <span className="inline-flex items-start gap-1 text-xs text-slate-500">
                      <CalendarDays size={13} className="mt-0.5 flex-shrink-0" />
                      {formatDate(item.modifiedGmt || item.modified)}
                    </span>
                    <span className="flex flex-col gap-1">
                      {item.editUrl && (
                        <a href={item.editUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                          Mở WP
                          <ExternalLink size={12} />
                        </a>
                      )}
                      {item.link && (
                        <a href={item.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-slate-500 hover:underline">
                          Xem
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
