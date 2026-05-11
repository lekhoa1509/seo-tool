import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Globe,
  Users,
  FileText,
  PenTool,
  BarChart2,
  MessageSquare,
  Image as ImageIcon,
  X,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

const navItems = [
  {
    label: 'Tổng quan',
    path: '/dashboard',
    icon: LayoutDashboard,
    color: 'text-indigo-500',
  },
  {
    label: 'Nghiên cứu từ khóa',
    path: '/keywords',
    icon: Search,
    color: 'text-blue-500',
    badge: 'AI',
  },
  {
    label: 'Kiểm tra kỹ thuật',
    path: '/audit',
    icon: Globe,
    color: 'text-emerald-500',
    badge: 'AI',
  },
  {
    label: 'Đối thủ cạnh tranh',
    path: '/competitors',
    icon: Users,
    color: 'text-orange-500',
    badge: 'AI',
  },
  {
    label: 'Tối ưu nội dung',
    path: '/content',
    icon: FileText,
    color: 'text-purple-500',
    badge: 'AI',
  },
  {
    label: 'Viết blog AI',
    path: '/blog',
    icon: PenTool,
    color: 'text-pink-500',
    badge: 'AI',
  },
  {
    label: 'Chat GPT',
    path: '/chat',
    icon: MessageSquare,
    color: 'text-indigo-500',
    badge: 'GPT-5.5',
  },
  {
    label: 'Tạo ảnh SEO',
    path: '/images',
    icon: ImageIcon,
    color: 'text-teal-500',
    badge: 'Image',
  },
  {
    label: 'Google Search Console',
    path: '/gsc',
    icon: BarChart2,
    color: 'text-green-500',
  },
];

export default function Sidebar({ onClose }) {
  const location = useLocation();

  return (
    <div className="h-full bg-white border-r border-slate-200 flex flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 gradient-bg rounded-xl flex items-center justify-center shadow-md">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-800 text-sm leading-none">SEO Pro</div>
            <div className="text-xs text-slate-400 mt-0.5">Công cụ SEO AI</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X size={16} className="text-slate-500" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        <div className="px-3 mb-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Công cụ</p>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group ${
                isActive
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Icon
                size={18}
                className={isActive ? 'text-primary-600' : item.color + ' group-hover:scale-110 transition-transform'}
              />
              <span className="flex-1 text-sm">{item.label}</span>
              {item.badge && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-primary-100 text-primary-600 rounded-full">
                  {item.badge}
                </span>
              )}
              {isActive && <ChevronRight size={14} className="text-primary-400" />}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-200">
        <div className="bg-gradient-to-br from-primary-50 to-indigo-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-primary-600" />
            <span className="text-xs font-semibold text-primary-700">GPT-5.5 Chat</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Có trợ lý chat riêng và bộ công cụ SEO AI cho công việc hằng ngày
          </p>
        </div>
        <p className="text-center text-xs text-slate-400 mt-3">SEO Pro v1.0</p>
      </div>
    </div>
  );
}
