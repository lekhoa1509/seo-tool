import React, { useState } from 'react';
import {
  Users, Plus, X, Loader2, TrendingUp, TrendingDown,
  Target, Link2, Search, BookOpen, Zap, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { competitorsAPI } from '../utils/api';

export default function CompetitorAnalysis() {
  const [form, setForm] = useState({
    yourDomain: '',
    competitors: ['', ''],
    targetKeyword: '',
    industry: '',
  });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const addCompetitor = () => {
    if (form.competitors.length < 5) {
      setForm({ ...form, competitors: [...form.competitors, ''] });
    }
  };

  const removeCompetitor = (i) => {
    const list = form.competitors.filter((_, idx) => idx !== i);
    setForm({ ...form, competitors: list });
  };

  const updateCompetitor = (i, val) => {
    const list = [...form.competitors];
    list[i] = val;
    setForm({ ...form, competitors: list });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validCompetitors = form.competitors.filter((c) => c.trim());
    if (!form.yourDomain || validCompetitors.length === 0) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const result = await competitorsAPI.analyze({ ...form, competitors: validCompetitors });
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const MetricCard = ({ label, yours, theirs, higherIsBetter = true }) => {
    const yoursNum = parseFloat(yours) || 0;
    const theirsNum = parseFloat(theirs) || 0;
    const better = higherIsBetter ? yoursNum >= theirsNum : yoursNum <= theirsNum;
    return (
      <div className="bg-slate-50 rounded-xl p-3">
        <div className="text-xs text-slate-500 mb-2">{label}</div>
        <div className="flex items-end gap-2">
          <div className={`text-lg font-bold ${better ? 'text-emerald-600' : 'text-red-500'}`}>
            {typeof yours === 'number' ? yours.toLocaleString() : yours}
          </div>
          <div className="text-xs text-slate-400 pb-0.5">vs {typeof theirs === 'number' ? theirs.toLocaleString() : theirs}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Users size={24} className="text-orange-500" />
          Phân tích đối thủ cạnh tranh
        </h1>
        <p className="text-slate-500 text-sm mt-1">Phân tích như SEMrush với AI GPT-4.1 Mini</p>
      </div>

      <div className="card p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Domain của bạn *</label>
              <input
                type="text"
                className="input"
                placeholder="yoursite.com"
                value={form.yourDomain}
                onChange={(e) => setForm({ ...form, yourDomain: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Ngành / Từ khóa mục tiêu</label>
              <input
                type="text"
                className="input"
                placeholder="vd: SEO tools, digital marketing..."
                value={form.targetKeyword}
                onChange={(e) => setForm({ ...form, targetKeyword: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">Domains đối thủ *</label>
            <div className="space-y-2">
              {form.competitors.map((comp, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder={`competitor${i + 1}.com`}
                    value={comp}
                    onChange={(e) => updateCompetitor(i, e.target.value)}
                  />
                  {form.competitors.length > 1 && (
                    <button type="button" onClick={() => removeCompetitor(i)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {form.competitors.length < 5 && (
              <button type="button" onClick={addCompetitor} className="mt-2 text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                <Plus size={14} />
                Thêm đối thủ (tối đa 5)
              </button>
            )}
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
            {loading ? 'Đang phân tích...' : 'Phân tích đối thủ'}
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
          <p className="font-medium text-slate-700">AI đang phân tích đối thủ...</p>
          <p className="text-sm text-slate-400">Có thể mất 30-60 giây</p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Summary */}
          <div className="card p-5">
            <p className="text-slate-600 leading-relaxed">{data.summary}</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit overflow-x-auto">
            {['overview', 'gaps', 'content', 'backlinks', 'action'].map((tab) => {
              const labels = {
                overview: 'Tổng quan', gaps: 'Keyword Gaps',
                content: 'Content Gaps', backlinks: 'Backlinks', action: 'Kế hoạch',
              };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* Overview tab */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Your domain */}
              <div className="card p-5">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Target size={16} className="text-primary-500" />
                  Domain của bạn: {data.yourDomain?.domain}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {data.competitors?.[0] && (
                    <>
                      <MetricCard label="Domain Authority" yours={data.yourDomain?.domainAuthority} theirs={data.competitors[0]?.domainAuthority} />
                      <MetricCard label="Organic Traffic" yours={data.yourDomain?.organicTraffic} theirs={data.competitors[0]?.organicTraffic} />
                      <MetricCard label="Organic Keywords" yours={data.yourDomain?.organicKeywords} theirs={data.competitors[0]?.organicKeywords} />
                      <MetricCard label="Backlinks" yours={data.yourDomain?.backlinks} theirs={data.competitors[0]?.backlinks} />
                    </>
                  )}
                </div>
              </div>

              {/* Competitors */}
              {data.competitors?.map((comp, i) => (
                <div key={i} className="card p-5">
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <Users size={16} className="text-orange-500" />
                    {comp.domain}
                    <span className="badge badge-blue">DA: {comp.domainAuthority}</span>
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-orange-50 rounded-xl p-3">
                      <div className="text-xs text-slate-500">Traffic</div>
                      <div className="font-bold text-orange-600 text-lg">{comp.organicTraffic?.toLocaleString()}</div>
                    </div>
                    <div className="bg-orange-50 rounded-xl p-3">
                      <div className="text-xs text-slate-500">Keywords</div>
                      <div className="font-bold text-orange-600 text-lg">{comp.organicKeywords?.toLocaleString()}</div>
                    </div>
                    <div className="bg-orange-50 rounded-xl p-3">
                      <div className="text-xs text-slate-500">Backlinks</div>
                      <div className="font-bold text-orange-600 text-lg">{comp.backlinks?.toLocaleString()}</div>
                    </div>
                    <div className="bg-orange-50 rounded-xl p-3">
                      <div className="text-xs text-slate-500">Content Score</div>
                      <div className="font-bold text-orange-600 text-lg">{comp.contentScore}/100</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {comp.strengths && (
                      <div>
                        <div className="text-xs font-semibold text-green-600 mb-1.5 flex items-center gap-1">
                          <CheckCircle size={12} /> Điểm mạnh
                        </div>
                        {comp.strengths.map((s, j) => (
                          <div key={j} className="text-sm text-slate-600 py-0.5">• {s}</div>
                        ))}
                      </div>
                    )}
                    {comp.weaknesses && (
                      <div>
                        <div className="text-xs font-semibold text-red-500 mb-1.5 flex items-center gap-1">
                          <AlertTriangle size={12} /> Điểm yếu
                        </div>
                        {comp.weaknesses.map((w, j) => (
                          <div key={j} className="text-sm text-slate-600 py-0.5">• {w}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Keyword gaps */}
          {activeTab === 'gaps' && (
            <div className="card overflow-hidden">
              <div className="p-5 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Search size={16} className="text-blue-500" />
                  Keyword Gaps – Từ khóa bạn đang bỏ lỡ ({data.keywordGaps?.length || 0})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">Từ khóa</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-600">Volume</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-600">Đối thủ #</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-600">Cơ hội</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">Idea nội dung</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.keywordGaps?.map((gap, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium text-slate-800">{gap.keyword}</td>
                        <td className="py-3 px-4 text-right text-blue-600 font-semibold">{gap.volume?.toLocaleString()}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-semibold text-slate-700">#{gap.competitorPosition}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`badge ${gap.opportunity === 'high' ? 'badge-green' : gap.opportunity === 'medium' ? 'badge-yellow' : 'badge-red'}`}>
                            {gap.opportunity === 'high' ? 'Cao' : gap.opportunity === 'medium' ? 'TB' : 'Thấp'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-xs max-w-xs">{gap.contentIdea}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Content gaps */}
          {activeTab === 'content' && (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <BookOpen size={16} className="text-purple-500" />
                Content Gaps – Chủ đề bạn chưa có
              </h3>
              {data.contentGaps?.map((gap, i) => (
                <div key={i} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800">{gap.topic}</div>
                      <div className="text-sm text-slate-500 mt-1">{gap.recommendation}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-slate-400">Est. Traffic</div>
                      <div className="font-bold text-emerald-600">{gap.estimatedTraffic?.toLocaleString()}</div>
                      <span className="badge badge-purple text-xs mt-1">{gap.contentType}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Backlinks */}
          {activeTab === 'backlinks' && (
            <div className="space-y-4">
              {data.backlinkOpportunities?.map((opp, i) => (
                <div key={i} className="card p-5">
                  <div className="flex items-start gap-3">
                    <Link2 size={18} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-800">{opp.type}</span>
                        <span className={`badge ${opp.impact === 'high' ? 'badge-green' : opp.impact === 'medium' ? 'badge-yellow' : 'badge-red'}`}>
                          Impact: {opp.impact}
                        </span>
                        <span className={`badge ${opp.difficulty === 'easy' ? 'badge-green' : opp.difficulty === 'medium' ? 'badge-yellow' : 'badge-red'}`}>
                          {opp.difficulty}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{opp.description}</p>
                      {opp.potentialDomains?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {opp.potentialDomains.map((d, j) => (
                            <span key={j} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{d}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action plan */}
          {activeTab === 'action' && data.actionPlan && (
            <div className="space-y-4">
              {[
                { key: 'immediate', label: 'Ngay lập tức (1-2 tuần)', color: 'bg-red-500', icon: Zap },
                { key: 'shortTerm', label: 'Ngắn hạn (1-3 tháng)', color: 'bg-orange-500', icon: TrendingUp },
                { key: 'longTerm', label: 'Dài hạn (3-12 tháng)', color: 'bg-blue-500', icon: Target },
              ].map(({ key, label, color, icon: Icon }) => (
                <div key={key} className="card p-5">
                  <h3 className={`font-semibold mb-3 flex items-center gap-2 text-slate-800`}>
                    <div className={`w-7 h-7 ${color} rounded-lg flex items-center justify-center`}>
                      <Icon size={14} className="text-white" />
                    </div>
                    {label}
                  </h3>
                  <div className="space-y-2">
                    {data.actionPlan[key]?.map((action, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                        <div className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <span className="text-sm text-slate-700">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {data.overallAnalysis && (
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-800 mb-3">Phân tích tổng thể</h3>
                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{data.overallAnalysis}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
