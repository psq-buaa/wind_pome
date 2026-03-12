import { useStore } from '../store';
import {
  LayoutDashboard, Database, Filter, BarChart3,
  TrendingUp, Settings, Wind, Tag, BookOpen,
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: '总览', icon: LayoutDashboard },
  { id: 'data', label: '数据管理', icon: Database },
  { id: 'keywords', label: '关键词过滤', icon: Tag },
  { id: 'classifier', label: '风意象分类', icon: Filter },
  { id: 'sentiment', label: '情感分析', icon: TrendingUp },
  { id: 'visualization', label: '可视化', icon: BarChart3 },
  { id: 'research', label: '研究助手', icon: BookOpen },
  { id: 'settings', label: '设置', icon: Settings },
];

export default function Sidebar() {
  const currentPage = useStore((s) => s.currentPage);
  const setCurrentPage = useStore((s) => s.setCurrentPage);

  return (
    <aside className="w-56 bg-white border-r border-ink-100 flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-ink-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-wind-600 flex items-center justify-center">
            <Wind className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-ink-800 leading-tight">风意象</h1>
            <p className="text-[11px] text-ink-400 leading-tight">唐诗情感分析</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-wind-50 text-wind-700 font-medium'
                  : 'text-ink-500 hover:bg-ink-50 hover:text-ink-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-ink-100">
        <p className="text-[11px] text-ink-300 text-center">
          全唐诗 · 风自然意象分析
        </p>
      </div>
    </aside>
  );
}
