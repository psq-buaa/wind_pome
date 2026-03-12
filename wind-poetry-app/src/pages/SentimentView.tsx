import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { analyzeSinglePoem } from '../ai';
import type { PoemEntry } from '../types';
import ReactECharts from 'echarts-for-react';
import { Zap, RefreshCw } from 'lucide-react';

export default function SentimentView() {
  const poems = useStore((s) => s.poems);
  const apiProvider = useStore((s) => s.apiProvider);
  const updatePoem = useStore((s) => s.updatePoem);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const [selectedSentiment, setSelectedSentiment] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // 只看自然意象
  const naturePoems = useMemo(() =>
    poems.filter(p => {
      const wt = p.humanOverride?.windType || p.analysis?.windType;
      return wt === 'nature';
    }),
    [poems]
  );

  // 情感已分析的
  const analyzedPoems = useMemo(() =>
    naturePoems.filter(p => p.analysis?.sentiment || p.humanOverride?.sentiment),
    [naturePoems]
  );

  const unanalyzed = naturePoems.filter(p => !p.analysis?.sentiment && !p.humanOverride?.sentiment);

  // 对未分析的进行情感分析
  async function runSentimentAnalysis() {
    if (!apiProvider) {
      alert('请先在"设置"中配置 API 密钥');
      setCurrentPage('settings');
      return;
    }
    setAnalyzing(true);
    for (const p of unanalyzed.slice(0, 50)) {
      try {
        const result = await analyzeSinglePoem(apiProvider, p.halfLine || '', p.content);
        updatePoem(p.id, p.halfLine, { analysis: result });
        await new Promise(r => setTimeout(r, 500));
      } catch {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    setAnalyzing(false);
  }

  // 情感统计
  const sentimentStats = useMemo(() => {
    const map: Record<string, PoemEntry[]> = {};
    analyzedPoems.forEach(p => {
      const s = p.humanOverride?.sentiment || p.analysis?.sentiment || '其他';
      if (!map[s]) map[s] = [];
      map[s].push(p);
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [analyzedPoems]);

  // 情感强度分布
  const intensityData = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    analyzedPoems.forEach(p => {
      const intensity = p.humanOverride?.sentimentIntensity || p.analysis?.sentimentIntensity || 3;
      counts[intensity - 1]++;
    });
    return counts;
  }, [analyzedPoems]);

  // 情感-子类交叉矩阵
  const crossData = useMemo(() => {
    const sentiments = new Set<string>();
    const subtypes = new Set<string>();
    const matrix: Record<string, Record<string, number>> = {};
    analyzedPoems.forEach(p => {
      const s = p.humanOverride?.sentiment || p.analysis?.sentiment || '其他';
      const st = p.humanOverride?.windSubtype || p.analysis?.windSubtype || '其他';
      sentiments.add(s);
      subtypes.add(st);
      if (!matrix[s]) matrix[s] = {};
      matrix[s][st] = (matrix[s][st] || 0) + 1;
    });
    return { sentiments: [...sentiments], subtypes: [...subtypes], matrix };
  }, [analyzedPoems]);

  // Radar chart data
  const radarOption = {
    tooltip: {},
    radar: {
      indicator: sentimentStats.slice(0, 8).map(([name]) => ({ name, max: Math.max(...sentimentStats.map(s => s[1].length)) + 5 })),
      shape: 'circle' as const,
    },
    series: [{
      type: 'radar',
      data: [{
        value: sentimentStats.slice(0, 8).map(([, poems]) => poems.length),
        name: '情感分布',
        areaStyle: { color: 'rgba(79,162,126,0.25)' },
        lineStyle: { color: '#338564' },
        itemStyle: { color: '#338564' },
      }],
    }],
  };

  // Intensity bar
  const intensityOption = {
    tooltip: { trigger: 'axis' as const },
    grid: { left: 40, right: 20, top: 10, bottom: 30 },
    xAxis: {
      type: 'category' as const,
      data: ['1-微弱', '2-轻微', '3-中等', '4-强烈', '5-极强'],
    },
    yAxis: { type: 'value' as const },
    series: [{
      type: 'bar',
      data: intensityData,
      itemStyle: {
        color: (params: any) => {
          const colors = ['#d6ece1', '#b0d9c5', '#7dbfa2', '#4fa27e', '#338564'];
          return colors[params.dataIndex] || '#338564';
        },
        borderRadius: [4, 4, 0, 0],
      },
    }],
  };

  // Heatmap
  const heatmapData: [number, number, number][] = [];
  crossData.sentiments.forEach((s, si) => {
    crossData.subtypes.forEach((st, sti) => {
      const val = crossData.matrix[s]?.[st] || 0;
      if (val > 0) heatmapData.push([sti, si, val]);
    });
  });

  const heatmapOption = {
    tooltip: {
      formatter: (p: any) => `${crossData.subtypes[p.data[0]]} × ${crossData.sentiments[p.data[1]]}: ${p.data[2]}首`,
    },
    grid: { left: 70, right: 20, top: 10, bottom: 60 },
    xAxis: {
      type: 'category' as const,
      data: crossData.subtypes,
      axisLabel: { fontSize: 10, rotate: 30 },
    },
    yAxis: {
      type: 'category' as const,
      data: crossData.sentiments,
      axisLabel: { fontSize: 10 },
    },
    visualMap: {
      min: 0,
      max: Math.max(...heatmapData.map(d => d[2]), 1),
      calculable: true,
      orient: 'horizontal' as const,
      left: 'center',
      bottom: 0,
      inRange: { color: ['#f0f7f4', '#338564'] },
    },
    series: [{
      type: 'heatmap',
      data: heatmapData,
      label: { show: true, fontSize: 10 },
    }],
  };

  const selectedPoems = selectedSentiment
    ? sentimentStats.find(([s]) => s === selectedSentiment)?.[1] || []
    : [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink-800">情感分析</h2>
          <p className="text-ink-400 text-sm mt-1">
            分析自然意象"风"的情感色彩（共 {naturePoems.length} 首自然意象，{analyzedPoems.length} 首已分析）
          </p>
        </div>
        {unanalyzed.length > 0 && (
          <button onClick={runSentimentAnalysis} disabled={analyzing}
            className="btn-primary flex items-center gap-1.5">
            {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {analyzing ? '分析中...' : `分析情感 (${unanalyzed.length}条)`}
          </button>
        )}
      </div>

      {analyzedPoems.length > 0 ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-semibold text-ink-700 mb-3">情感雷达图</h3>
              <ReactECharts option={radarOption} style={{ height: 300 }} />
            </div>
            <div className="card">
              <h3 className="font-semibold text-ink-700 mb-3">情感强度分布</h3>
              <ReactECharts option={intensityOption} style={{ height: 300 }} />
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-ink-700 mb-3">情感 × 风型交叉热力图</h3>
            <ReactECharts option={heatmapOption} style={{ height: Math.max(250, crossData.sentiments.length * 35 + 80) }} />
          </div>

          {/* Sentiment cards */}
          <div>
            <h3 className="font-semibold text-ink-700 mb-3">按情感分类浏览</h3>
            <div className="flex gap-2 flex-wrap mb-4">
              {sentimentStats.map(([name, poems]) => (
                <button
                  key={name}
                  onClick={() => setSelectedSentiment(selectedSentiment === name ? null : name)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedSentiment === name
                      ? 'bg-wind-600 text-white'
                      : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                  }`}
                >
                  {name} ({poems.length})
                </button>
              ))}
            </div>

            {selectedPoems.length > 0 && (
              <div className="space-y-2">
                {selectedPoems.slice(0, 30).map((p, i) => (
                  <div key={`${p.id}_${i}`} className="card !py-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-medium text-ink-700">《{p.title}》</span>
                        <span className="text-ink-400 text-xs ml-2">{p.author}</span>
                        {p.halfLine && (
                          <p className="text-wind-600 text-sm mt-1">"{p.halfLine}"</p>
                        )}
                        {p.analysis?.imageDescription && (
                          <p className="text-ink-400 text-xs mt-1 italic">{p.analysis.imageDescription}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="tag-nature">{p.analysis?.windSubtype || '风'}</span>
                        <p className="text-xs text-ink-400 mt-1">
                          强度 {p.analysis?.sentimentIntensity || '?'}/5
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="card text-center py-12 text-ink-400">
          <p>暂无情感分析数据</p>
          <p className="text-xs mt-1">请先在"风意象分类"中完成分类，然后对自然意象进行情感分析</p>
        </div>
      )}
    </div>
  );
}
