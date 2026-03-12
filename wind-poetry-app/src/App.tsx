import React from 'react';
import { useStore } from './store';
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
  const Page = pages[currentPage] || Dashboard;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Page />
      </main>
    </div>
  );
}
