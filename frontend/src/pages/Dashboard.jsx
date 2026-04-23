import React from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Globe, Users, FileText, PenTool, BarChart2,
  ArrowRight, Sparkles, TrendingUp, Zap, Shield,
} from 'lucide-react';

const tools = [
  {
    title: 'Keyword Research',
    description: 'Khám phá từ khóa tiềm năng, phân tích volume, độ khó và search intent',
    icon: Search,
    path: '/keywords',
    color: 'from-blue-500 to-indigo-600',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    features: ['Search Volume', 'Keyword Difficulty', 'Search Intent', 'Topic Clusters'],
  },
  {
    title: 'Technical SEO Audit',
    description: 'Kiểm tra toàn diện SEO kỹ thuật: meta tags, headings, schema, performance',
    icon: Globe,
    path: '/audit',
    color: 'from-emerald-500 to-teal-600',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-600',
    features: ['Meta Tags', 'Page Speed', 'Schema Markup', 'Core Web Vitals'],
  },
  {
    title: 'Phân tích đối thủ',
    description: 'Phân tích chiến lược SEO của đối thủ như SEMrush, tìm keyword gaps',
    icon: Users,
    path: '/competitors',
    color: 'from-orange-500 to-red-600',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    features: ['Domain Authority', 'Keyword Gaps', 'Backlink Analysis', 'Content Strategy'],
  },
  {
    title: 'Content Optimization',
    description: 'Tối ưu nội dung theo chuẩn SEO, kiểm tra readability và E-E-A-T',
    icon: FileText,
    path: '/content',
    color: 'from-purple-500 to-pink-600',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-600',
    features: ['Keyword Density', 'Readability', 'E-E-A-T Score', 'LSI Keywords'],
  },
  {
    title: 'AI Blog Writer',
    description: 'Viết bài blog SEO chuẩn theo chủ đề với AI, đầy đủ meta và schema',
    icon: PenTool,
    path: '/blog',
    color: 'from-pink-500 to-rose-600',
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-600',
    features: ['Full Article', 'Meta Tags', 'FAQ Schema', 'Content Brief'],
  },
  {
    title: 'Google Search Console',
    description: 'Kết nối GSC để theo dõi traffic, từ khóa và hiệu suất trang web',
    icon: BarChart2,
    path: '/gsc',
    color: 'from-green-500 to-emerald-600',
    bgColor: 'bg-green-50',
    textColor: 'text-green-600',
    features: ['Search Analytics', 'Top Queries', 'Click-Through Rate', 'Average Position'],
  },
];

const stats = [
  { label: 'AI Model', value: 'GPT-4.1 Mini', icon: Sparkles, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { label: 'Tools Available', value: '6 Tools', icon: Zap, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'SEO Checks', value: '50+ Checks', icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Performance', value: 'Real-time', icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
];

export default function Dashboard() {
  return (
    <div className="animate-fadeIn space-y-8">
      {/* Hero section */}
      <div className="gradient-bg rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-4 w-32 h-32 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-4 left-1/2 w-24 h-24 rounded-full bg-white blur-3xl" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={20} className="text-yellow-300" />
            <span className="text-sm font-medium text-indigo-200">Powered by GPT-4.1 Mini</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">SEO Pro Tool</h1>
          <p className="text-indigo-200 text-lg max-w-xl">
            Nền tảng SEO all-in-one với AI. Nghiên cứu từ khóa, audit website,
            phân tích đối thủ và viết content SEO chuẩn.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Link to="/keywords" className="bg-white text-primary-700 font-semibold px-5 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors flex items-center gap-2 text-sm">
              <Search size={16} />
              Bắt đầu nghiên cứu từ khóa
            </Link>
            <Link to="/blog" className="bg-white/20 hover:bg-white/30 text-white font-medium px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 text-sm border border-white/30">
              <PenTool size={16} />
              Viết bài với AI
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={18} className={stat.color} />
              </div>
              <div>
                <div className={`font-bold text-lg leading-none ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tools grid */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-4">Tất cả công cụ</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.path}
                to={tool.path}
                className="card p-5 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 group"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <Icon size={22} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-800 group-hover:text-primary-600 transition-colors">
                        {tool.title}
                      </h3>
                      <ArrowRight size={16} className="text-slate-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
                    </div>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">{tool.description}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {tool.features.map((f) => (
                    <span key={f} className={`text-xs px-2 py-0.5 rounded-full ${tool.bgColor} ${tool.textColor} font-medium`}>
                      {f}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick start guide */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Zap size={18} className="text-yellow-500" />
          Hướng dẫn nhanh
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { step: '1', title: 'Cấu hình API', desc: 'Thêm OpenAI API key vào file backend/.env để kích hoạt tính năng AI', color: 'bg-indigo-600' },
            { step: '2', title: 'Nghiên cứu từ khóa', desc: 'Bắt đầu với Keyword Research để tìm cơ hội SEO trong niche của bạn', color: 'bg-blue-600' },
            { step: '3', title: 'Tối ưu & Viết bài', desc: 'Dùng Content Optimization và Blog Writer để tạo nội dung chuẩn SEO', color: 'bg-emerald-600' },
          ].map((item) => (
            <div key={item.step} className="flex gap-4">
              <div className={`w-8 h-8 ${item.color} rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5`}>
                {item.step}
              </div>
              <div>
                <div className="font-semibold text-slate-800 text-sm">{item.title}</div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
