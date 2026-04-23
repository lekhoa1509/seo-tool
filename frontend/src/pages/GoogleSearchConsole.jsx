import React, { useState, useEffect } from 'react';
import {
  BarChart2, Link2, Loader2, ExternalLink, TrendingUp, TrendingDown,
  Eye, MousePointer, Target, AlertTriangle, CheckCircle, RefreshCw,
  Search, Globe,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { gscAPI } from '../utils/api';

export default function GoogleSearchConsole() {
  const [status, setStatus] = useState({ connected: false, configured: false });
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [summary, setSummary] = useState(null);
  const [queries, setQueries] = useState([]);
  const [pages, setPages] = useState([]);
  const [activeTab, setActiveTab] = useState('queries');
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState('28');

  useEffect(() => {
    fetchStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      fetchStatus();
      window.history.replaceState({}, '', '/gsc');
    }
    if (params.get('error')) {
      setError(decodeURIComponent(params.get('error')));
      window.history.replaceState({}, '', '/gsc');
    }
  }, []);

  const fetchStatus = async () => {
    try {
      const result = await gscAPI.getStatus();
      setStatus(result);
      if (result.connected) fetchSites();
    } catch {}
  };

  const fetchSites = async () => {
    try {
      const result = await gscAPI.getSites();
      setSites(result.sites || []);
      if (result.sites?.length > 0) {
        setSelectedSite(result.sites[0].siteUrl);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleConnect = async () => {
    try {
      const result = await gscAPI.getAuthUrl();
      if (result.authUrl) {
        window.location.href = result.authUrl;
      } else if (result.setupGuide) {
        setError(result.message + '\n\nSetup Guide:\n' + result.setupGuide.join('\n'));
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDisconnect = async () => {
    await gscAPI.disconnect();
    setStatus({ connected: false, configured: status.configured });
    setSites([]);
    setSummary(null);
    setQueries([]);
    setPages([]);
  };

  const fetchData = async () => {
    if (!selectedSite) return;
    setLoading(true);
    setError('');

    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - +dateRange * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
      const [sumResult, queryResult, pageResult] = await Promise.all([
        gscAPI.getSummary({ siteUrl: selectedSite }),
        gscAPI.getPerformance({ siteUrl: selectedSite, startDate, endDate, dimensions: ['query'], rowLimit: 25 }),
        gscAPI.getPages({ siteUrl: selectedSite, startDate, endDate, rowLimit: 25 }),
      ]);
      setSummary(sumResult);
      setQueries(queryResult.rows || []);
      setPages(pageResult.pages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSite && status.connected) fetchData();
  }, [selectedSite, dateRange]);

  const MetricCard = ({ icon: Icon, label, value, change, color, bg }) => {
    const changeNum = parseFloat(change);
    const isPositive = changeNum >= 0;
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center`}>
            <Icon size={16} className={color} />
          </div>
          {change !== undefined && (
            <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
              {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(changeNum)}%
            </div>
          )}
        </div>
        <div className="text-2xl font-bold text-slate-800 mb-0.5">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    );
  };

  if (!status.connected) {
    return (
      <div className="animate-fadeIn space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart2 size={24} className="text-green-500" />
            Google Search Console
          </h1>
          <p className="text-slate-500 text-sm mt-1">Kết nối GSC để theo dõi hiệu suất tìm kiếm</p>
        </div>

        <div className="card p-8 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BarChart2 size={28} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Kết nối Google Search Console</h2>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            Kết nối tài khoản GSC để xem dữ liệu tìm kiếm, từ khóa, lượt click và vị trí xếp hạng.
          </p>

          {!status.configured && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-left">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-amber-700 text-sm">Cần cấu hình Google OAuth</div>
                  <p className="text-amber-600 text-xs mt-1">
                    Thêm GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET vào file backend/.env
                  </p>
                </div>
              </div>
            </div>
          )}

          <button onClick={handleConnect} className="btn-primary w-full justify-center">
            <Link2 size={16} />
            Kết nối với Google Search Console
          </button>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-500" />
            Hướng dẫn cài đặt Google OAuth
          </h3>
          <div className="space-y-3">
            {[
              { step: '1', title: 'Tạo Project trong Google Cloud Console', desc: 'Vào console.cloud.google.com → Tạo project mới' },
              { step: '2', title: 'Bật Search Console API', desc: 'APIs & Services → Enable APIs → Tìm "Google Search Console API"' },
              { step: '3', title: 'Tạo OAuth 2.0 Credentials', desc: 'APIs & Services → Credentials → Create OAuth 2.0 Client ID' },
              { step: '4', title: 'Cấu hình Redirect URI', desc: 'Thêm: http://localhost:3001/api/gsc/callback' },
              { step: '5', title: 'Copy credentials vào .env', desc: 'GOOGLE_CLIENT_ID=... và GOOGLE_CLIENT_SECRET=...' },
            ].map((item) => (
              <div key={item.step} className="flex gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="w-7 h-7 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {item.step}
                </div>
                <div>
                  <div className="font-medium text-slate-800 text-sm">{item.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <pre className="text-red-700 text-xs whitespace-pre-wrap">{error}</pre>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart2 size={24} className="text-green-500" />
            Google Search Console
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <CheckCircle size={14} className="text-green-500" />
            <span className="text-sm text-green-600">Đã kết nối</span>
          </div>
        </div>
        <button onClick={handleDisconnect} className="btn-outline text-sm text-red-500 border-red-200 hover:bg-red-50">
          Ngắt kết nối
        </button>
      </div>

      {/* Site selector & date range */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-40">
          <Globe size={16} className="text-slate-400 flex-shrink-0" />
          <select
            className="input flex-1"
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
          >
            {sites.map((site) => (
              <option key={site.siteUrl} value={site.siteUrl}>{site.siteUrl}</option>
            ))}
          </select>
        </div>
        <select
          className="input w-40"
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
        >
          <option value="7">7 ngày qua</option>
          <option value="14">14 ngày qua</option>
          <option value="28">28 ngày qua</option>
          <option value="90">3 tháng qua</option>
        </select>
        <button onClick={fetchData} className="btn-primary text-sm" disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Cập nhật
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="card p-12 flex flex-col items-center gap-4">
          <div className="w-10 h-10 loading-spinner" />
          <p className="text-slate-600">Đang tải dữ liệu GSC...</p>
        </div>
      )}

      {summary && !loading && (
        <>
          {/* Summary metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={MousePointer} label="Tổng Clicks"
              value={summary.current.clicks?.toLocaleString()}
              change={summary.changes?.clicks}
              color="text-blue-600" bg="bg-blue-50"
            />
            <MetricCard
              icon={Eye} label="Impressions"
              value={summary.current.impressions?.toLocaleString()}
              change={summary.changes?.impressions}
              color="text-purple-600" bg="bg-purple-50"
            />
            <MetricCard
              icon={TrendingUp} label="CTR Trung bình"
              value={`${summary.current.ctr}%`}
              change={summary.changes?.ctr}
              color="text-green-600" bg="bg-green-50"
            />
            <MetricCard
              icon={Target} label="Vị trí TB"
              value={summary.current.position}
              change={summary.changes?.position}
              color="text-orange-600" bg="bg-orange-50"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            {['queries', 'pages'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab === 'queries' ? 'Top Queries' : 'Top Pages'}
              </button>
            ))}
          </div>

          {/* Queries table */}
          {activeTab === 'queries' && queries.length > 0 && (
            <div className="card overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-center gap-2">
                <Search size={16} className="text-blue-500" />
                <h3 className="font-semibold text-slate-800">Top Search Queries</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">Query</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-600">Clicks</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-600">Impressions</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-600">CTR</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-600">Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {queries.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium text-slate-800">{row.keys?.[0]}</td>
                        <td className="py-3 px-4 text-right text-blue-600 font-semibold">{row.clicks?.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-slate-600">{row.impressions?.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-medium ${row.ctr * 100 > 5 ? 'text-green-600' : 'text-slate-600'}`}>
                            {(row.ctr * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-semibold ${row.position <= 3 ? 'text-green-600' : row.position <= 10 ? 'text-amber-500' : 'text-red-500'}`}>
                            #{Math.round(row.position)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pages table */}
          {activeTab === 'pages' && pages.length > 0 && (
            <div className="card overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-center gap-2">
                <Globe size={16} className="text-purple-500" />
                <h3 className="font-semibold text-slate-800">Top Pages</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">Page URL</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-600">Clicks</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-600">Impressions</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-600">CTR</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-600">Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pages.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-3 px-4 max-w-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-700 truncate">{row.keys?.[0]}</span>
                            <a href={row.keys?.[0]} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-blue-600 font-semibold">{row.clicks?.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-slate-600">{row.impressions?.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-medium ${row.ctr * 100 > 5 ? 'text-green-600' : 'text-slate-600'}`}>
                            {(row.ctr * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-semibold ${row.position <= 3 ? 'text-green-600' : row.position <= 10 ? 'text-amber-500' : 'text-red-500'}`}>
                            #{Math.round(row.position)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
