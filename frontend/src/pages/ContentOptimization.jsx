import React, { useState } from 'react';
import {
  FileText, Loader2, TrendingUp, CheckCircle, AlertTriangle,
  XCircle, Eye, List, BarChart2, Zap, BookOpen, Target,
} from 'lucide-react';
import { contentAPI } from '../utils/api';

const ScoreBar = ({ label, score, color = 'bg-primary-500' }) => (
  <div>
    <div className="flex justify-between text-sm mb-1">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-800">{score}/100</span>
    </div>
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'
        }`}
        style={{ width: `${score}%` }}
      />
    </div>
  </div>
);

export default function ContentOptimization() {
  const [form, setForm] = useState({ content: '', targetKeyword: '', language: 'Vietnamese' });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('scores');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.content.trim() || !form.targetKeyword.trim()) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const result = await contentAPI.optimize(form);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOutline = async () => {
    const topic = form.targetKeyword || form.content.substring(0, 100);
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await contentAPI.outline({ topic, targetKeyword: form.targetKeyword });
      setData({ ...data, outline: result });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const lsiUsageColor = (usage) => {
    if (usage === 'good') return 'badge-green';
    if (usage === 'underused') return 'badge-yellow';
    return 'badge-red';
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <FileText size={24} className="text-purple-500" />
          Content Optimization
        </h1>
        <p className="text-slate-500 text-sm mt-1">Tối ưu nội dung theo chuẩn SEO với AI</p>
      </div>

      <div className="card p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Từ khóa mục tiêu *</label>
              <input
                type="text"
                className="input"
                placeholder="vd: học SEO cơ bản"
                value={form.targetKeyword}
                onChange={(e) => setForm({ ...form, targetKeyword: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Ngôn ngữ</label>
              <select className="input" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                <option value="Vietnamese">Tiếng Việt</option>
                <option value="English">English</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Nội dung cần tối ưu *</label>
            <textarea
              className="textarea"
              rows={10}
              placeholder="Dán nội dung bài viết vào đây để phân tích và tối ưu..."
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              required
            />
            <div className="text-xs text-slate-400 mt-1">
              {form.content.split(/\s+/).filter(w => w).length} từ
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
              {loading ? 'Đang phân tích...' : 'Phân tích & Tối ưu'}
            </button>
            <button
              type="button"
              onClick={handleOutline}
              className="btn-secondary"
              disabled={loading}
            >
              <List size={16} />
              Tạo Outline
            </button>
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
          <p className="font-medium text-slate-700">AI đang phân tích nội dung...</p>
        </div>
      )}

      {data && !loading && !data.outline && (
        <>
          {/* Top priorities */}
          {data.topPriorities && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Zap size={16} className="text-yellow-500" />
                Ưu tiên hàng đầu
              </h3>
              <div className="space-y-2">
                {data.topPriorities.map((p, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-xl border border-yellow-100">
                    <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <span className="text-sm text-slate-700">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit overflow-x-auto">
            {[
              { key: 'scores', label: 'Điểm SEO' },
              { key: 'title', label: 'Tiêu đề' },
              { key: 'lsi', label: 'LSI Keywords' },
              { key: 'improvements', label: 'Cải thiện' },
              { key: 'eeat', label: 'E-E-A-T' },
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

          {/* Scores */}
          {activeTab === 'scores' && data.scores && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-slate-800">Điểm số SEO</h3>
                <ScoreBar label="Tổng thể" score={data.scores.overall} />
                <ScoreBar label="Readability" score={data.scores.readability} />
                <ScoreBar label="Keyword Optimization" score={data.scores.keywordOptimization} />
                <ScoreBar label="Độ sâu nội dung" score={data.scores.contentDepth} />
                <ScoreBar label="E-E-A-T" score={data.scores.eeat} />
                <ScoreBar label="Cấu trúc" score={data.scores.structure} />
              </div>

              <div className="card p-5">
                <h3 className="font-semibold text-slate-800 mb-4">Phân tích chi tiết</h3>
                {data.analysis && (
                  <div className="space-y-3">
                    {[
                      { label: 'Số từ hiện tại', value: data.analysis.wordCount?.toLocaleString(), target: `Mục tiêu: ${data.analysis.targetWordCount?.toLocaleString()}` },
                      { label: 'Keyword Density', value: `${data.analysis.keywordDensity}%`, target: `Lý tưởng: ${data.analysis.idealKeywordDensity}` },
                      { label: 'Readability', value: data.analysis.readabilityLevel },
                      { label: 'Avg Sentence Length', value: `${data.analysis.avgSentenceLength} từ` },
                      { label: 'Passive Voice', value: `${data.analysis.passiveVoicePercentage}%` },
                    ].map(({ label, value, target }) => (
                      <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                        <span className="text-sm text-slate-500">{label}</span>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-slate-800">{value}</div>
                          {target && <div className="text-xs text-slate-400">{target}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {data.technicalChecks && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <h4 className="text-sm font-semibold text-slate-600 mb-3">Technical Checks</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(data.technicalChecks).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2 text-sm">
                          {val ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-red-400" />}
                          <span className="text-slate-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Title optimization */}
          {activeTab === 'title' && (
            <div className="space-y-4">
              <div className="card p-5">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Target size={16} className="text-blue-500" />
                  Đề xuất tiêu đề tối ưu
                </h3>
                {data.titleOptimization?.suggestions?.map((s, i) => (
                  <div key={i} className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="font-semibold text-slate-800">{s.title}</div>
                    <div className="text-xs text-blue-600 mt-1">{s.reason}</div>
                    <div className="text-xs text-slate-400 mt-1">{s.title?.length} ký tự</div>
                  </div>
                ))}
              </div>
              {data.metaDescription?.suggestions && (
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-800 mb-4">Meta Description</h3>
                  {data.metaDescription.suggestions.map((s, i) => (
                    <div key={i} className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                      <p className="text-sm text-slate-700">{s.description}</p>
                      <div className={`text-xs mt-1 ${s.length > 160 ? 'text-red-500' : 'text-slate-400'}`}>
                        {s.length} / 160 ký tự
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* LSI Keywords */}
          {activeTab === 'lsi' && (
            <div className="card overflow-hidden">
              <div className="p-5 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800">LSI Keywords & Từ khóa liên quan</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {data.lsiKeywords?.map((kw, i) => (
                  <div key={i} className="p-4 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-medium text-slate-800">{kw.keyword}</div>
                      <div className="text-sm text-slate-500 mt-0.5">{kw.suggestion}</div>
                    </div>
                    <span className={`badge ${lsiUsageColor(kw.usage)} flex-shrink-0`}>
                      {kw.usage === 'good' ? '✓ Tốt' : kw.usage === 'underused' ? '⚠ Ít dùng' : '✗ Thiếu'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Improvements */}
          {activeTab === 'improvements' && (
            <div className="space-y-3">
              {data.contentImprovements?.map((imp, i) => (
                <div key={i} className={`card p-5 border-l-4 ${
                  imp.priority === 'high' ? 'border-l-red-500' : imp.priority === 'medium' ? 'border-l-yellow-500' : 'border-l-blue-500'
                }`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="font-semibold text-slate-800">{imp.section}</div>
                    <span className={`badge ${imp.priority === 'high' ? 'badge-red' : imp.priority === 'medium' ? 'badge-yellow' : 'badge-blue'} flex-shrink-0`}>
                      {imp.priority === 'high' ? 'Cao' : imp.priority === 'medium' ? 'TB' : 'Thấp'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">{imp.issue}</p>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs font-semibold text-green-600 mb-1">Gợi ý cải thiện:</div>
                    <p className="text-sm text-green-800">{imp.suggestion}</p>
                    {imp.improvedText && (
                      <div className="mt-2 text-xs text-slate-500 italic">"{imp.improvedText}"</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* E-E-A-T */}
          {activeTab === 'eeat' && data.eeatSignals && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(data.eeatSignals).map(([key, val]) => (
                <div key={key} className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-800 capitalize">{key}</h3>
                    <div className={`text-2xl font-bold ${val.score >= 70 ? 'text-emerald-600' : val.score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                      {val.score}
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full mb-4">
                    <div
                      className={`h-full rounded-full ${val.score >= 70 ? 'bg-emerald-500' : val.score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${val.score}%` }}
                    />
                  </div>
                  <ul className="space-y-1.5">
                    {val.improvements?.map((imp, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <TrendingUp size={12} className="text-blue-500 mt-0.5 flex-shrink-0" />
                        {imp}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Outline result */}
      {data?.outline && (
        <div className="card p-5 space-y-4">
          <h2 className="text-xl font-bold text-slate-800">{data.outline.title}</h2>
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-blue">{data.outline.readingTime}</span>
            <span className="badge badge-purple">{data.outline.estimatedWordCount?.toLocaleString()} từ</span>
            <span className="badge badge-green">Focus: {data.outline.targetKeyword}</span>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1">Meta Description</div>
            <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl">{data.outline.metaDescription}</p>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-2">Outline</div>
            <div className="space-y-1.5">
              {data.outline.outline?.map((item, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl text-sm ${
                    item.type === 'h1' ? 'bg-indigo-100 font-bold text-indigo-800' :
                    item.type === 'h2' ? 'bg-blue-50 font-semibold text-blue-800 ml-2' :
                    item.type === 'intro' ? 'bg-green-50 text-green-700' :
                    'bg-slate-50 text-slate-700 ml-6'
                  }`}
                >
                  {item.heading}
                  {item.notes && <div className="text-xs text-slate-400 mt-0.5 font-normal">{item.notes}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
