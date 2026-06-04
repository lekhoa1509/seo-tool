import React, { useState } from 'react';
import {
  Users, Plus, X, Loader2, TrendingUp, Target, Link2, Search, BookOpen, Zap,
  AlertTriangle, CheckCircle, Gauge, FileText, ArrowUpRight, ArrowDownRight, Sparkles,
} from 'lucide-react';
import { competitorsAPI } from '../utils/api';

const parseMetricValue = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const formatMetricValue = (value, suffix = '') => {
  if (value === null || value === undefined || value === '') return 'Không có';
  if (typeof value === 'number') return `${value.toLocaleString()}${suffix}`;
  return `${value}${suffix}`;
};

const translateDifficulty = (value) => {
  const labels = {
    easy: 'Dễ',
    medium: 'Trung bình',
    hard: 'Khó',
  };

  return labels[String(value).toLowerCase()] || value;
};

const translateImpact = (value) => {
  const labels = {
    high: 'Cao',
    medium: 'Trung bình',
    low: 'Thấp',
  };

  return labels[String(value).toLowerCase()] || value;
};

const translateContentType = (value) => {
  const labels = {
    blog: 'Bài blog',
    guide: 'Hướng dẫn',
    tool: 'Công cụ',
    comparison: 'So sánh',
  };

  return labels[String(value).toLowerCase()] || value;
};

const translateBacklinkType = (value) => {
  const labels = {
    'guest post': 'Bài guest post',
    'resource page': 'Trang tài nguyên',
    'broken link': 'Liên kết gãy',
    directory: 'Danh bạ',
  };

  return labels[String(value).toLowerCase()] || value;
};

const metricToneClasses = {
  orange: 'bg-orange-50 text-orange-600',
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  purple: 'bg-purple-50 text-purple-600',
  slate: 'bg-slate-50 text-slate-700',
};

const listToneClasses = {
  slate: {
    wrapper: 'border-slate-200 bg-slate-50/80',
    icon: 'text-slate-500',
    title: 'text-slate-700',
    bullet: 'text-slate-400',
  },
  green: {
    wrapper: 'border-emerald-200 bg-emerald-50/80',
    icon: 'text-emerald-600',
    title: 'text-emerald-700',
    bullet: 'text-emerald-500',
  },
  red: {
    wrapper: 'border-red-200 bg-red-50/80',
    icon: 'text-red-500',
    title: 'text-red-600',
    bullet: 'text-red-400',
  },
  orange: {
    wrapper: 'border-orange-200 bg-orange-50/80',
    icon: 'text-orange-500',
    title: 'text-orange-700',
    bullet: 'text-orange-400',
  },
};

const MetricCard = ({ label, yours, theirs, higherIsBetter = true }) => {
  const yoursNum = parseMetricValue(yours);
  const theirsNum = parseMetricValue(theirs);
  const better = higherIsBetter ? yoursNum >= theirsNum : yoursNum <= theirsNum;

  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="text-xs text-slate-500 mb-2">{label}</div>
      <div className="flex items-end gap-2">
        <div className={`text-lg font-bold ${better ? 'text-emerald-600' : 'text-red-500'}`}>
          {formatMetricValue(yours)}
        </div>
        <div className="text-xs text-slate-400 pb-0.5">so với {formatMetricValue(theirs)}</div>
      </div>
    </div>
  );
};

const CompetitorStat = ({ label, value, tone = 'orange' }) => (
  <div className={`rounded-2xl p-3 ${metricToneClasses[tone] || metricToneClasses.orange}`}>
    <div className="text-xs text-slate-500">{label}</div>
    <div className="font-bold text-lg mt-1">{formatMetricValue(value)}</div>
  </div>
);

const GapInsight = ({ label, yours, theirs }) => {
  const yoursNum = parseMetricValue(yours);
  const theirsNum = parseMetricValue(theirs);

  if (!yoursNum && !theirsNum) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="text-sm font-semibold text-slate-700">{label}</div>
        <div className="text-sm text-slate-400 mt-1">Chưa đủ dữ liệu để so sánh.</div>
      </div>
    );
  }

  const difference = Math.abs(theirsNum - yoursNum);
  const isEqual = theirsNum === yoursNum;
  const competitorAhead = theirsNum > yoursNum;
  const Icon = isEqual ? Target : competitorAhead ? ArrowUpRight : ArrowDownRight;
  const wrapperClass = isEqual
    ? 'border-slate-200 bg-slate-50/80'
    : competitorAhead
      ? 'border-orange-200 bg-orange-50/80'
      : 'border-emerald-200 bg-emerald-50/80';
  const titleClass = isEqual
    ? 'text-slate-700'
    : competitorAhead
      ? 'text-orange-700'
      : 'text-emerald-700';
  const iconClass = isEqual
    ? 'text-slate-500'
    : competitorAhead
      ? 'text-orange-500'
      : 'text-emerald-500';

  return (
    <div className={`rounded-2xl border p-4 ${wrapperClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
          <div className={`font-semibold mt-1 ${titleClass}`}>
            {isEqual
              ? 'Ngang bằng với tên miền của bạn'
              : `${competitorAhead ? 'Nhỉnh hơn' : 'Thấp hơn'} ${difference.toLocaleString()}`}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Bạn: {formatMetricValue(yours)} | Đối thủ: {formatMetricValue(theirs)}
          </div>
        </div>
        <div className="w-9 h-9 rounded-full bg-white/80 flex items-center justify-center flex-shrink-0">
          <Icon size={16} className={iconClass} />
        </div>
      </div>
    </div>
  );
};

const InsightList = ({ title, items, icon: Icon, tone = 'slate', emptyText }) => {
  const palette = listToneClasses[tone] || listToneClasses.slate;
  const listItems = Array.isArray(items) ? items.filter(Boolean) : [];

  return (
    <div className={`rounded-2xl border p-4 ${palette.wrapper}`}>
      <div className={`text-sm font-semibold mb-2 flex items-center gap-2 ${palette.title}`}>
        <Icon size={14} className={palette.icon} />
        {title}
      </div>
      {listItems.length > 0 ? (
        <div className="space-y-2">
          {listItems.map((item, index) => (
            <div key={index} className="flex items-start gap-2 text-sm text-slate-600">
              <span className={`mt-1 ${palette.bullet}`}>•</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-400">{emptyText}</div>
      )}
    </div>
  );
};

const StrategyPanel = ({ title, description, icon: Icon, footer }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
    <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
      <Icon size={14} className="text-slate-500" />
      {title}
    </div>
    <p className="text-sm text-slate-600 leading-relaxed">
      {description || 'Chưa có ghi chú chiến lược cụ thể.'}
    </p>
    {footer}
  </div>
);

const TopKeywordTable = ({ keywords }) => {
  const rows = Array.isArray(keywords) ? keywords.slice(0, 4) : [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Search size={14} className="text-blue-500" />
          Từ khóa nổi bật
        </div>
        <span className="text-xs text-slate-400">{rows.length > 0 ? `${rows.length} từ khóa` : 'Chưa có dữ liệu'}</span>
      </div>

      {rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((keyword, index) => (
            <div key={`${keyword.keyword}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800">{keyword.keyword}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Lượng tìm kiếm: {formatMetricValue(keyword.volume)} | Lưu lượng: {formatMetricValue(keyword.traffic)}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-slate-400">Vị trí</div>
                  <div className="font-semibold text-blue-600">
                    {keyword.position === null || keyword.position === undefined ? 'Không có' : `#${formatMetricValue(keyword.position)}`}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-400">AI chưa trả về bộ top keywords cho đối thủ này.</div>
      )}
    </div>
  );
};

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

  const benchmarkCompetitor = data?.competitors?.reduce((best, competitor) => (
    parseMetricValue(competitor?.organicTraffic) > parseMetricValue(best?.organicTraffic) ? competitor : best
  ), data?.competitors?.[0] || null);

  return (
    <div className="animate-fadeIn space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Users size={24} className="text-orange-500" />
          Phân tích đối thủ cạnh tranh
        </h1>
        <p className="text-slate-500 text-sm mt-1">Phân tích như SEMrush với cx/gpt-5.5</p>
      </div>

      <div className="card p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Tên miền của bạn *</label>
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
                placeholder="vd: công cụ SEO, marketing số..."
                value={form.targetKeyword}
                onChange={(e) => setForm({ ...form, targetKeyword: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">Tên miền đối thủ *</label>
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
          <div className="card p-5">
            <p className="text-slate-600 leading-relaxed">{data.summary}</p>
          </div>

          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit overflow-x-auto">
            {['overview', 'gaps', 'content', 'backlinks', 'action'].map((tab) => {
              const labels = {
                overview: 'Tổng quan',
                gaps: 'Khoảng trống từ khóa',
                content: 'Khoảng trống nội dung',
                backlinks: 'Backlink',
                action: 'Kế hoạch',
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

          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="card p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                      <Target size={16} className="text-primary-500" />
                      Tên miền của bạn: {data.yourDomain?.domain}
                    </h3>
                    {benchmarkCompetitor && (
                      <p className="text-xs text-slate-500 mt-1">So sánh nhanh với đối thủ có lưu lượng truy cập tự nhiên cao nhất: {benchmarkCompetitor.domain}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.yourDomain?.contentScore !== undefined && (
                      <span className="badge badge-purple">Nội dung {formatMetricValue(data.yourDomain?.contentScore, '/100')}</span>
                    )}
                    {data.yourDomain?.technicalScore !== undefined && (
                      <span className="badge badge-blue">Kỹ thuật {formatMetricValue(data.yourDomain?.technicalScore, '/100')}</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  {benchmarkCompetitor && (
                    <>
                      <MetricCard label="Uy tín tên miền" yours={data.yourDomain?.domainAuthority} theirs={benchmarkCompetitor?.domainAuthority} />
                      <MetricCard label="Lưu lượng tự nhiên" yours={data.yourDomain?.organicTraffic} theirs={benchmarkCompetitor?.organicTraffic} />
                      <MetricCard label="Từ khóa tự nhiên" yours={data.yourDomain?.organicKeywords} theirs={benchmarkCompetitor?.organicKeywords} />
                      <MetricCard label="Backlink" yours={data.yourDomain?.backlinks} theirs={benchmarkCompetitor?.backlinks} />
                      <MetricCard label="Điểm nội dung" yours={data.yourDomain?.contentScore} theirs={benchmarkCompetitor?.contentScore} />
                      <MetricCard label="Điểm kỹ thuật" yours={data.yourDomain?.technicalScore} theirs={benchmarkCompetitor?.technicalScore} />
                    </>
                  )}
                </div>
              </div>

              {data.competitors?.map((comp, i) => {
                const technicalRisks = comp.technicalRisks?.length ? comp.technicalRisks : comp.weaknesses?.slice(0, 3);

                return (
                  <div key={i} className="card p-5 space-y-5">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                          <Users size={16} className="text-orange-500" />
                          {comp.domain}
                          <span className="badge badge-blue">Uy tín: {formatMetricValue(comp.domainAuthority)}</span>
                        </h3>
                        {comp.marketPosition && (
                          <p className="text-sm text-slate-500 mt-1 max-w-3xl">{comp.marketPosition}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {comp.publishingCadence && (
                          <span className="badge badge-purple">{comp.publishingCadence}</span>
                        )}
                        {comp.contentScore !== undefined && (
                          <span className="badge badge-green">Nội dung {formatMetricValue(comp.contentScore, '/100')}</span>
                        )}
                        {comp.technicalScore !== undefined && (
                          <span className="badge badge-blue">Kỹ thuật {formatMetricValue(comp.technicalScore, '/100')}</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                      <CompetitorStat label="Lưu lượng" value={comp.organicTraffic} tone="orange" />
                      <CompetitorStat label="Từ khóa" value={comp.organicKeywords} tone="orange" />
                      <CompetitorStat label="Backlink" value={comp.backlinks} tone="orange" />
                      <CompetitorStat label="Điểm nội dung" value={formatMetricValue(comp.contentScore, '/100')} tone="emerald" />
                      <CompetitorStat label="Điểm kỹ thuật" value={formatMetricValue(comp.technicalScore, '/100')} tone="blue" />
                      <CompetitorStat label="Từ khóa nổi bật" value={comp.topKeywords?.length || 0} tone="purple" />
                    </div>

                    {comp.siteSnapshot && (
                      <InsightList
                        title="Tín hiệu website đã crawl"
                        items={comp.siteSnapshot?.keySignals}
                        icon={Search}
                        tone="slate"
                        emptyText={
                          comp.siteSnapshot?.crawlStatus?.startsWith('error:')
                            ? `Chưa lấy được dữ liệu website: ${comp.siteSnapshot.crawlStatus.replace('error:', '').trim()}`
                            : 'Chưa có đủ tín hiệu rõ ràng từ website này.'
                        }
                      />
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <GapInsight label="Chênh lệch lưu lượng" yours={data.yourDomain?.organicTraffic} theirs={comp.organicTraffic} />
                      <GapInsight label="Chênh lệch từ khóa" yours={data.yourDomain?.organicKeywords} theirs={comp.organicKeywords} />
                      <GapInsight label="Chênh lệch backlink" yours={data.yourDomain?.backlinks} theirs={comp.backlinks} />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <StrategyPanel
                        title="Chiến lược nội dung"
                        icon={FileText}
                        description={comp.contentStrategy}
                        footer={comp.contentThemes?.length ? (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {comp.contentThemes.map((theme, index) => (
                              <span key={index} className="text-xs px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600">
                                {theme}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      />

                      <StrategyPanel
                        title="Liên kết và kỹ thuật"
                        icon={Gauge}
                        description={comp.linkProfile}
                        footer={(
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                            <InsightList
                              title="Ưu thế kỹ thuật"
                              items={comp.technicalHighlights}
                              icon={CheckCircle}
                              tone="green"
                              emptyText="Chưa có điểm kỹ thuật nổi bật được AI xác định."
                            />
                            <InsightList
                              title="Rủi ro cần lưu ý"
                              items={technicalRisks}
                              icon={AlertTriangle}
                              tone="red"
                              emptyText="Chưa có rủi ro kỹ thuật rõ ràng."
                            />
                          </div>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                      <TopKeywordTable keywords={comp.topKeywords} />
                      <InsightList
                        title="Điểm mạnh"
                        items={comp.strengths}
                        icon={Sparkles}
                        tone="green"
                        emptyText="Chưa có danh sách điểm mạnh cụ thể."
                      />
                      <InsightList
                        title="Điểm yếu"
                        items={comp.weaknesses}
                        icon={AlertTriangle}
                        tone="red"
                        emptyText="Chưa có danh sách điểm yếu cụ thể."
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'gaps' && (
            <div className="card overflow-hidden">
              <div className="p-5 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Search size={16} className="text-blue-500" />
                  Khoảng trống từ khóa - những từ khóa bạn đang bỏ lỡ ({data.keywordGaps?.length || 0})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">Từ khóa</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-600">Lượng tìm kiếm</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-600">Đối thủ #</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-600">Cơ hội</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">Gợi ý nội dung</th>
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
                            {gap.opportunity === 'high' ? 'Cao' : gap.opportunity === 'medium' ? 'Trung bình' : 'Thấp'}
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

          {activeTab === 'content' && (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <BookOpen size={16} className="text-purple-500" />
                Khoảng trống nội dung - chủ đề bạn chưa có
              </h3>
              {data.contentGaps?.map((gap, i) => (
                <div key={i} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800">{gap.topic}</div>
                      <div className="text-sm text-slate-500 mt-1">{gap.recommendation}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-slate-400">Lưu lượng ước tính</div>
                      <div className="font-bold text-emerald-600">{gap.estimatedTraffic?.toLocaleString()}</div>
                      <span className="badge badge-purple text-xs mt-1">{translateContentType(gap.contentType)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'backlinks' && (
            <div className="space-y-4">
              {data.backlinkOpportunities?.map((opp, i) => (
                <div key={i} className="card p-5">
                  <div className="flex items-start gap-3">
                    <Link2 size={18} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-slate-800">{translateBacklinkType(opp.type)}</span>
                        <span className={`badge ${opp.impact === 'high' ? 'badge-green' : opp.impact === 'medium' ? 'badge-yellow' : 'badge-red'}`}>
                          Tác động: {translateImpact(opp.impact)}
                        </span>
                        <span className={`badge ${opp.difficulty === 'easy' ? 'badge-green' : opp.difficulty === 'medium' ? 'badge-yellow' : 'badge-red'}`}>
                          {translateDifficulty(opp.difficulty)}
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

          {activeTab === 'action' && data.actionPlan && (
            <div className="space-y-4">
              {[
                { key: 'immediate', label: 'Ngay lập tức (1-2 tuần)', color: 'bg-red-500', icon: Zap },
                { key: 'shortTerm', label: 'Ngắn hạn (1-3 tháng)', color: 'bg-orange-500', icon: TrendingUp },
                { key: 'longTerm', label: 'Dài hạn (3-12 tháng)', color: 'bg-blue-500', icon: Target },
              ].map(({ key, label, color, icon: Icon }) => (
                <div key={key} className="card p-5">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-slate-800">
                    <div className={`w-7 h-7 ${color} rounded-lg flex items-center justify-center`}>
                      <Icon size={14} className="text-white" />
                    </div>
                    {label}
                  </h3>
                  <div className="space-y-2">
                    {data.actionPlan[key]?.map((action, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                        <div className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0 mt-0.5">
                          {index + 1}
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
