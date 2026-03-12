import { useStore } from '../store';
import { Wind, BookOpen, CheckCircle, AlertCircle } from 'lucide-react';
import ReactECharts from 'echarts-for-react';

export default function Dashboard() {
  const poems = useStore((s) => s.poems);

  const total = poems.length;
  const natureCount = poems.filter(p => p.analysis?.windType === 'nature').length;
  const nonNatureCount = poems.filter(p => p.analysis?.windType === 'non-nature').length;
  const pendingCount = poems.filter(p => !p.analysis || p.analysis.windType === 'pending').length;
  const reviewedCount = poems.filter(p => p.humanReviewed).length;

  // 情感分布
  const sentimentMap: Record<string, number> = {};
  poems.forEach(p => {
    const s = p.humanOverride?.sentiment || p.analysis?.sentiment;
    if (s && (p.humanOverride?.windType || p.analysis?.windType) === 'nature') {
      sentimentMap[s] = (sentimentMap[s] || 0) + 1;
    }
  });
  const sentimentData = Object.entries(sentimentMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // 风子类分布
  const subtypeMap: Record<string, number> = {};
  poems.forEach(p => {
    const st = p.humanOverride?.windSubtype || p.analysis?.windSubtype;
    if (st && (p.humanOverride?.windType || p.analysis?.windType) === 'nature') {
      subtypeMap[st] = (subtypeMap[st] || 0) + 1;
    }
  });
  const subtypeData = Object.entries(subtypeMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // 作者 TOP10
  const authorMap: Record<string, number> = {};
  poems.forEach(p => { authorMap[p.author] = (authorMap[p.author] || 0) + 1; });
  const authorTop = Object.entries(authorMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const sentimentPieOption = {
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
    color: ['#338564', '#4fa27e', '#7dbfa2', '#b0d9c5', '#d6ece1',
            '#e8a838', '#e07e3c', '#c9544d', '#9a5fa3', '#5b7fb8',
            '#7d7165', '#524a41', '#3d3832', '#2a2622'],
    series: [{
      type: 'pie', radius: ['35%', '65%'],
      label: { fontSize: 11 },
      data: sentimentData.length > 0 ? sentimentData : [{ name: '暂无数据', value: 1 }],
    }],
  };

  const subtypeBarOption = {
    tooltip: { trigger: 'axis' as const },
    grid: { left: 60, right: 20, top: 10, bottom: 30 },
    xAxis: {
      type: 'category' as const,
      data: subtypeData.map(d => d.name),
      axisLabel: { fontSize: 10, rotate: 30 },
    },
    yAxis: { type: 'value' as const },
    series: [{
      type: 'bar',
      data: subtypeData.map(d => d.value),
      itemStyle: { color: '#338564', borderRadius: [4, 4, 0, 0] },
    }],
  };

  const authorBarOption = {
    tooltip: { trigger: 'axis' as const },
    grid: { left: 80, right: 20, top: 10, bottom: 10 },
    yAxis: {
      type: 'category' as const,
      data: authorTop.map(a => a[0]).reverse(),
      axisLabel: { fontSize: 11 },
    },
    xAxis: { type: 'value' as const },
    series: [{
      type: 'bar',
      data: authorTop.map(a => a[1]).reverse(),
      itemStyle: { color: '#4fa27e', borderRadius: [0, 4, 4, 0] },
    }],
  };

  const stats = [
    { label: '诗歌总数', value: total, icon: BookOpen, color: 'text-wind-600 bg-wind-50' },
    { label: '自然意象', value: natureCount, icon: Wind, color: 'text-green-600 bg-green-50' },
    { label: '非自然意象', value: nonNatureCount, icon: AlertCircle, color: 'text-amber-600 bg-amber-50' },
    { label: '已审核', value: reviewedCount, icon: CheckCircle, color: 'text-blue-600 bg-blue-50' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-ink-800">总览</h2>
        <p className="text-ink-400 text-sm mt-1">
          {total > 0 ? `已加载 ${total} 条含"风"诗句，其中 ${pendingCount} 条待分析` : '请先在"数据管理"中加载诗歌数据'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-ink-800">{s.value}</p>
                <p className="text-xs text-ink-400">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold text-ink-700 mb-3">情感分布</h3>
          <ReactECharts option={sentimentPieOption} style={{ height: 280 }} />
        </div>
        <div className="card">
          <h3 className="font-semibold text-ink-700 mb-3">风意象子类分布</h3>
          <ReactECharts option={subtypeBarOption} style={{ height: 280 }} />
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-ink-700 mb-3">诗人含"风"诗句 TOP 10</h3>
        <ReactECharts option={authorBarOption} style={{ height: 300 }} />
      </div>
    </div>
  );
}
