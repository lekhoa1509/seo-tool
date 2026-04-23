import React, { useState } from 'react';
import {
  Globe, CheckCircle, XCircle, AlertTriangle, Loader2,
  ExternalLink, Info, Shield, Zap, FileSearch, Tag,
} from 'lucide-react';
import { auditAPI } from '../utils/api';

const CheckIcon = ({ status }) => {
  if (status === 'pass') return <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />;
  if (status === 'fail') return <XCircle size={16} className="text-red-500 flex-shrink-0" />;
  return <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />;
};

const statusColor = (status) => {
  if (status === 'pass') return 'bg-emerald-50 border-emerald-200';
  if (status === 'fail') return 'bg-red-50 border-red-200';
  return 'bg-amber-50 border-amber-200';
};

const ScoreGauge = ({ score }) => {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B+' : score >= 60 ? 'B' : score >= 50 ? 'C' : 'D';
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${score * 2.51} 251`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color }}>{score}</span>
          <span className="text-xs text-slate-400">/100</span>
        </div>
      </div>
      <div className="mt-1 text-sm font-bold" style={{ color }}>{grade}</div>
    </div>
  );
};

export default function TechnicalAudit() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const result = await auditAPI.auditUrl({ url });
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checks = data?.checks ? Object.entries(data.checks) : [];
  const passCount = checks.filter(([, v]) => v?.status === 'pass').length;
  const failCount = checks.filter(([, v]) => v?.status === 'fail').length;
  const warnCount = checks.filter(([, v]) => v?.status === 'warning').length;

  const checkLabels = {
    title: 'Title Tag', metaDescription: 'Meta Description', h1: 'H1 Heading',
    canonical: 'Canonical URL', https: 'HTTPS', viewport: 'Viewport',
    images: 'Image Alt Text', schema: 'Schema Markup', wordCount: 'Word Count', links: 'Internal Links',
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Globe size={24} className="text-emerald-500" />
          Technical SEO Audit
        </h1>
        <p className="text-slate-500 text-sm mt-1">Kiểm tra toàn diện SEO kỹ thuật cho website</p>
      </div>

      <div className="card p-5">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              className="input"
              placeholder="https://example.com hoặc example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <FileSearch size={16} />}
            {loading ? 'Đang audit...' : 'Kiểm tra SEO'}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          <strong>Lỗi:</strong> {error}
        </div>
      )}

      {loading && (
        <div className="card p-12 flex flex-col items-center gap-4">
          <div className="w-12 h-12 loading-spinner" />
          <p className="font-medium text-slate-700">Đang phân tích website...</p>
          <p className="text-sm text-slate-400">AI đang kiểm tra SEO, có thể mất 30-60 giây</p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Score overview */}
          <div className="card p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <ScoreGauge score={data.score || 0} />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-800 mb-1">
                  SEO Score: {data.grade}
                </h2>
                <p className="text-slate-500 text-sm mb-4">{data.summary}</p>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-sm text-slate-600">{passCount} Passed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-sm text-slate-600">{warnCount} Warnings</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm text-slate-600">{failCount} Failed</span>
                  </div>
                </div>
              </div>
              <a
                href={url.startsWith('http') ? url : `https://${url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline text-sm"
              >
                <ExternalLink size={14} />
                Xem trang
              </a>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            {['overview', 'issues', 'details', 'recommendations'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab === 'overview' ? 'Tổng quan' : tab === 'issues' ? 'Vấn đề' : tab === 'details' ? 'Chi tiết' : 'Gợi ý'}
              </button>
            ))}
          </div>

          {/* Overview */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {checks.map(([key, val]) => (
                <div key={key} className={`border rounded-xl p-4 ${statusColor(val?.status)}`}>
                  <div className="flex items-start gap-3">
                    <CheckIcon status={val?.status} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 text-sm">{checkLabels[key] || key}</div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">{val?.value || 'N/A'}</div>
                      {val?.recommendation && val.status !== 'pass' && (
                        <div className="text-xs text-slate-600 mt-1.5 leading-relaxed">{val.recommendation}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Issues */}
          {activeTab === 'issues' && data.issues && (
            <div className="space-y-4">
              {data.issues.critical?.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
                    <XCircle size={16} className="text-red-500" />
                    <span className="font-semibold text-red-700">Critical Issues ({data.issues.critical.length})</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {data.issues.critical.map((issue, i) => (
                      <div key={i} className="p-5">
                        <div className="font-semibold text-slate-800 text-sm mb-1">{issue.title}</div>
                        <p className="text-sm text-slate-600 mb-2">{issue.description}</p>
                        <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                          <strong>Cách sửa:</strong> {issue.fix}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.issues.warnings?.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500" />
                    <span className="font-semibold text-amber-700">Warnings ({data.issues.warnings.length})</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {data.issues.warnings.map((issue, i) => (
                      <div key={i} className="p-4">
                        <div className="font-semibold text-slate-800 text-sm mb-1">{issue.title}</div>
                        <p className="text-sm text-slate-500">{issue.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.issues.opportunities?.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 bg-green-50 border-b border-green-100 flex items-center gap-2">
                    <Info size={16} className="text-green-600" />
                    <span className="font-semibold text-green-700">Cơ hội ({data.issues.opportunities.length})</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {data.issues.opportunities.map((issue, i) => (
                      <div key={i} className="p-4">
                        <div className="font-semibold text-slate-800 text-sm mb-1">{issue.title}</div>
                        <p className="text-sm text-slate-500">{issue.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Details */}
          {activeTab === 'details' && data.pageData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-5 space-y-3">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Tag size={16} className="text-blue-500" />
                  Meta Information
                </h3>
                {[
                  { label: 'Title', value: data.pageData.title, max: 60 },
                  { label: 'Meta Description', value: data.pageData.metaDescription, max: 160 },
                  { label: 'Canonical', value: data.pageData.canonical },
                  { label: 'Robots', value: data.pageData.robots },
                ].map(({ label, value, max }) => (
                  <div key={label}>
                    <div className="text-xs font-medium text-slate-500 mb-0.5">{label}</div>
                    <div className="text-sm text-slate-700 bg-slate-50 rounded px-2 py-1.5 break-all">
                      {value || <span className="text-red-400 italic">Không có</span>}
                    </div>
                    {max && value && (
                      <div className={`text-xs mt-0.5 ${value.length > max ? 'text-red-500' : 'text-slate-400'}`}>
                        {value.length}/{max} ký tự
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="card p-5 space-y-3">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Zap size={16} className="text-yellow-500" />
                  Page Statistics
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Word Count', value: data.pageData.wordCount?.toLocaleString() },
                    { label: 'H1 Tags', value: data.pageData.h1?.length || 0 },
                    { label: 'H2 Tags', value: data.pageData.h2?.length || 0 },
                    { label: 'Hình ảnh', value: data.pageData.images?.length || 0 },
                    { label: 'Internal Links', value: data.pageData.links?.internal || 0 },
                    { label: 'External Links', value: data.pageData.links?.external || 0 },
                    { label: 'HTTPS', value: data.pageData.hasHttps ? '✓' : '✗' },
                    { label: 'Schema', value: data.pageData.hasSchema ? '✓' : '✗' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">{label}</div>
                      <div className="font-semibold text-slate-800 mt-0.5">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {data.pageData.h1?.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <Shield size={16} className="text-purple-500" />
                    Heading Structure
                  </h3>
                  <div className="space-y-2">
                    {data.pageData.h1?.map((h, i) => (
                      <div key={i} className="text-sm font-medium px-3 py-2 bg-blue-50 text-blue-800 rounded-lg">
                        H1: {h}
                      </div>
                    ))}
                    {data.pageData.h2?.slice(0, 5).map((h, i) => (
                      <div key={i} className="text-sm px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg ml-4">
                        H2: {h}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recommendations */}
          {activeTab === 'recommendations' && (
            <div className="card p-5 space-y-3">
              <h3 className="font-semibold text-slate-800 mb-2">Ưu tiên cải thiện</h3>
              {data.recommendations?.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                  <div className="w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
