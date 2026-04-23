import React, { useState } from 'react';
import {
  Search, TrendingUp, Target, DollarSign, BarChart2,
  ChevronDown, ChevronUp, Loader2, Lightbulb, Layers,
  Download, Filter, ArrowUpRight,
} from 'lucide-react';
import { keywordsAPI } from '../utils/api';

const difficultyColor = (d) => {
  if (d <= 30) return 'badge-green';
  if (d <= 60) return 'badge-yellow';
  return 'badge-red';
};

const difficultyLabel = (d) => {
  if (d <= 30) return 'Dễ';
  if (d <= 60) return 'Trung bình';
  return 'Khó';
};

const intentColor = (intent) => {
  const map = {
    informational: 'badge-blue',
    commercial: 'badge-purple',
    transactional: 'badge-green',
    navigational: 'badge-yellow',
  };
  return map[intent] || 'badge-blue';
};

const intentLabel = (intent) => {
  const map = {
    informational: 'Thông tin',
    commercial: 'Thương mại',
    transactional: 'Giao dịch',
    navigational: 'Điều hướng',
  };
  return map[intent] || intent;
};

export default function KeywordResearch() {
  const [form, setForm] = useState({ seedKeyword: '', niche: '', language: 'Vietnamese', count: 20 });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [sortBy, setSortBy] = useState('searchVolume');
  const [filterIntent, setFilterIntent] = useState('all');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.seedKeyword.trim()) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const result = await keywordsAPI.research(form);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sortedKeywords = data?.keywords
    ? [...data.keywords]
        .filter((k) => filterIntent === 'all' || k.intent === filterIntent)
        .sort((a, b) => {
          if (sortBy === 'searchVolume') return b.searchVolume - a.searchVolume;
          if (sortBy === 'difficulty') return a.difficulty - b.difficulty;
          if (sortBy === 'cpc') return b.cpc - a.cpc;
          return 0;
        })
    : [];

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ['Keyword', 'Search Volume', 'Difficulty', 'CPC', 'Intent', 'Competition', 'Trend'],
      ...sortedKeywords.map((k) => [k.keyword, k.searchVolume, k.difficulty, k.cpc, k.intent, k.competition, k.trend]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keywords-${form.seedKeyword}.csv`;
    a.click();
  };

  return (
    <div className="animate-fadeIn space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Search size={24} className="text-blue-500" />
          Keyword Research
        </h1>
        <p className="text-slate-500 text-sm mt-1">Nghiên cứu từ khóa với AI GPT-4.1 Mini</p>
      </div>

      {/* Form */}
      <div className="card p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="label">Seed Keyword *</label>
              <input
                type="text"
                className="input"
                placeholder="vd: SEO, marketing, bất động sản..."
                value={form.seedKeyword}
                onChange={(e) => setForm({ ...form, seedKeyword: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Ngành / Niche</label>
              <input
                type="text"
                className="input"
                placeholder="vd: E-commerce, Health..."
                value={form.niche}
                onChange={(e) => setForm({ ...form, niche: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Ngôn ngữ</label>
              <select
                className="input"
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
              >
                <option value="Vietnamese">Tiếng Việt</option>
                <option value="English">English</option>
                <option value="Japanese">Japanese</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {loading ? 'Đang phân tích...' : 'Nghiên cứu từ khóa'}
            </button>
            <span className="text-sm text-slate-400">Khoảng 30-60 giây</span>
          </div>
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
          <div className="text-center">
            <p className="font-medium text-slate-700">AI đang phân tích từ khóa...</p>
            <p className="text-sm text-slate-400 mt-1">GPT-4.1 Mini đang xử lý dữ liệu</p>
          </div>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Summary */}
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="font-bold text-slate-800 text-lg">
                  Kết quả cho: <span className="text-primary-600">"{data.seedKeyword}"</span>
                </h2>
                <p className="text-slate-500 text-sm mt-1">{data.summary}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={exportCSV} className="btn-outline text-sm">
                  <Download size={14} />
                  Export CSV
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
              {[
                { label: 'Tổng từ khóa', value: data.keywords?.length || 0, icon: Search, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Quick Wins', value: data.quickWins?.length || 0, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Topic Clusters', value: data.topicClusters?.length || 0, icon: Layers, color: 'text-purple-600', bg: 'bg-purple-50' },
                { label: 'Content Ideas', value: data.contentIdeas?.length || 0, icon: Lightbulb, color: 'text-yellow-600', bg: 'bg-yellow-50' },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className={`${stat.bg} rounded-xl p-4`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={14} className={stat.color} />
                      <span className="text-xs text-slate-500">{stat.label}</span>
                    </div>
                    <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick wins */}
          {data.quickWins && data.quickWins.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <TrendingUp size={16} className="text-green-500" />
                Quick Wins – Từ khóa cơ hội
              </h3>
              <div className="flex flex-wrap gap-2">
                {data.quickWins.map((kw, i) => (
                  <span key={i} className="px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-200">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Keywords table */}
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
              <h3 className="font-semibold text-slate-800">
                Danh sách từ khóa ({sortedKeywords.length})
              </h3>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400" />
                <select
                  className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={filterIntent}
                  onChange={(e) => setFilterIntent(e.target.value)}
                >
                  <option value="all">Tất cả intent</option>
                  <option value="informational">Thông tin</option>
                  <option value="commercial">Thương mại</option>
                  <option value="transactional">Giao dịch</option>
                  <option value="navigational">Điều hướng</option>
                </select>
                <select
                  className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="searchVolume">Volume cao nhất</option>
                  <option value="difficulty">Độ khó thấp nhất</option>
                  <option value="cpc">CPC cao nhất</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-slate-600">Từ khóa</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-600">Volume</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-600">Độ khó</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-600">CPC</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-600">Intent</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-600">Cạnh tranh</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-600">Xu hướng</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedKeywords.map((kw, i) => (
                    <React.Fragment key={i}>
                      <tr
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => setExpanded(expanded === i ? null : i)}
                      >
                        <td className="py-3 px-4 font-medium text-slate-800">{kw.keyword}</td>
                        <td className="py-3 px-4 text-right font-semibold text-blue-600">
                          {kw.searchVolume?.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="flex-1 max-w-16 h-1.5 bg-slate-200 rounded-full">
                              <div
                                className={`h-1.5 rounded-full ${kw.difficulty <= 30 ? 'bg-green-500' : kw.difficulty <= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${kw.difficulty}%` }}
                              />
                            </div>
                            <span className={`badge ${difficultyColor(kw.difficulty)}`}>
                              {kw.difficulty} · {difficultyLabel(kw.difficulty)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">${kw.cpc?.toFixed(2)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`badge ${intentColor(kw.intent)}`}>{intentLabel(kw.intent)}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`badge ${kw.competition === 'low' ? 'badge-green' : kw.competition === 'medium' ? 'badge-yellow' : 'badge-red'}`}>
                            {kw.competition === 'low' ? 'Thấp' : kw.competition === 'medium' ? 'TB' : 'Cao'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`text-xs font-medium ${kw.trend === 'growing' ? 'text-green-600' : kw.trend === 'declining' ? 'text-red-500' : 'text-slate-500'}`}>
                            {kw.trend === 'growing' ? '↑ Tăng' : kw.trend === 'declining' ? '↓ Giảm' : '→ Ổn'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center text-slate-400">
                          {expanded === i ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                      </tr>
                      {expanded === i && kw.longTail && (
                        <tr className="bg-indigo-50/50">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="text-xs font-semibold text-slate-500 mb-2">Long-tail variations:</div>
                            <div className="flex flex-wrap gap-2">
                              {kw.longTail.map((lt, j) => (
                                <span key={j} className="px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-full text-xs">
                                  {lt}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Topic clusters */}
          {data.topicClusters && data.topicClusters.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Layers size={16} className="text-purple-500" />
                Topic Clusters
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.topicClusters.map((cluster, i) => (
                  <div key={i} className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                    <div className="font-semibold text-purple-800 text-sm mb-2">{cluster.pillarTopic}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {cluster.clusterKeywords?.map((kw, j) => (
                        <span key={j} className="text-xs px-2 py-0.5 bg-white text-purple-600 rounded-full border border-purple-200">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content ideas */}
          {data.contentIdeas && data.contentIdeas.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Lightbulb size={16} className="text-yellow-500" />
                Ý tưởng nội dung
              </h3>
              <div className="space-y-2">
                {data.contentIdeas.map((idea, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-xl border border-yellow-100">
                    <ArrowUpRight size={14} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700">{idea}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
