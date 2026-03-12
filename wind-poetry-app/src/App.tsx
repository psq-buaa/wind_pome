import React, { useEffect } from 'react';
import { useStore } from './store';
import { loadBuiltinPoemData } from './dataLoader';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import DataManager from './pages/DataManager';
import Classifier from './pages/Classifier';
import SentimentView from './pages/SentimentView';
import Visualization from './pages/Visualization';
import Settings from './pages/Settings';

const pages: Record<string, React.FC> = {
  dashboard: Dashboard,
  data: DataManager,
  classifier: Classifier,
  sentiment: SentimentView,
  visualization: Visualization,
  settings: Settings,
};

export default function App() {
  const currentPage = useStore((s) => s.currentPage);
  const poems = useStore((s) => s.poems);
  const setPoems = useStore((s) => s.setPoems);
  const Page = pages[currentPage] || Dashboard;

  // 启动时自动加载内置数据并恢复分析结果
  useEffect(() => {
    if (poems.length === 0) {
      loadBuiltinPoemData([]).then(entries => {
        if (entries.length > 0) setPoems(entries);
      }).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Page />
      </main>
    </div>
  );
}
