import { useMemo, useState, useRef } from 'react';
import { useStore } from '../store';
import ReactECharts from 'echarts-for-react';
import { Camera, Download } from 'lucide-react';
import 'echarts-wordcloud';

type ChartType = 'wordcloud' | 'network' | 'sankey' | 'timeline' | 'treemap' | 'scatter';

export default function Visualization() {
  const poems = useStore((s) => s.poems);
  const [chartType, setChartType] = useState<ChartType>('wordcloud');
  const chartRef = useRef<ReactECharts>(null);

  const naturePoems = useMemo(() =>
    poems.filter(p => (p.humanOverride?.windType || p.analysis?.windType) === 'nature'),
    [poems]
  );

  // 导出图片
  function exportImage() {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    const url = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    const a = document.createElement('a');
    a.href = url;
    a.download = `wind_${chartType}_${Date.now()}.png`;
    a.click();
  }

  // 1. 词云
  const wordcloudOption = useMemo(() => {
    const wordMap: Record<string, number> = {};
    naturePoems.forEach(p => {
      const kws = p.humanOverride?.keywords || p.analysis?.keywords || [];
      kws.forEach(k => { wordMap[k] = (wordMap[k] || 0) + 1; });
      // 补充风子类
      const st = p.humanOverride?.windSubtype || p.analysis?.windSubtype;
      if (st) wordMap[st] = (wordMap[st] || 0) + 1;
    });
    const data = Object.entries(wordMap).map(([name, value]) => ({ name, value }));
    return {
      tooltip: { show: true },
      series: [{
        type: 'wordCloud',
        shape: 'circle',
        sizeRange: [14, 60],
        rotationRange: [-45, 45],
        gridSize: 8,
        textStyle: {
          fontFamily: 'Noto Serif SC, serif',
          color: () => {
            const colors = ['#338564', '#4fa27e', '#7dbfa2', '#266b50', '#1f5641',
                            '#e8a838', '#c9544d', '#5b7fb8', '#9a5fa3', '#524a41'];
            return colors[Math.floor(Math.random() * colors.length)];
          },
        },
        data: data.length > 0 ? data : [{ name: '风', value: 1 }],
      }],
    };
  }, [naturePoems]);

  // 2. 关联网络图
  const networkOption = useMemo(() => {
    const sentimentMap: Record<string, string[]> = {};
    const subtypeMap: Record<string, string[]> = {};
    naturePoems.forEach(p => {
      const s = p.humanOverride?.sentiment || p.analysis?.sentiment;
      const st = p.humanOverride?.windSubtype || p.analysis?.windSubtype;
      if (s && st) {
        if (!sentimentMap[s]) sentimentMap[s] = [];
        sentimentMap[s].push(st);
        if (!subtypeMap[st]) subtypeMap[st] = [];
        subtypeMap[st].push(s);
      }
    });

    const nodes: any[] = [];
    const links: any[] = [];
    const nodeSet = new Set<string>();

    // Center node
    nodes.push({ name: '风', symbolSize: 50, category: 0,
      itemStyle: { color: '#338564' } });
    nodeSet.add('风');

    // Subtype nodes
    Object.keys(subtypeMap).forEach(st => {
      if (!nodeSet.has(st)) {
        nodes.push({ name: st, symbolSize: 20 + subtypeMap[st].length * 2, category: 1,
          itemStyle: { color: '#4fa27e' } });
        nodeSet.add(st);
        links.push({ source: '风', target: st });
      }
    });

    // Sentiment nodes
    Object.keys(sentimentMap).forEach(s => {
      if (!nodeSet.has(s)) {
        nodes.push({ name: s, symbolSize: 15 + sentimentMap[s].length * 2, category: 2,
          itemStyle: { color: '#e8a838' } });
        nodeSet.add(s);
      }
    });

    // Links
    const linkSet = new Set<string>();
    naturePoems.forEach(p => {
      const s = p.humanOverride?.sentiment || p.analysis?.sentiment;
      const st = p.humanOverride?.windSubtype || p.analysis?.windSubtype;
      if (s && st) {
        const key = `${st}-${s}`;
        if (!linkSet.has(key)) {
          linkSet.add(key);
          links.push({ source: st, target: s });
        }
      }
    });

    return {
      tooltip: {},
      legend: { data: ['风', '风型', '情感'], top: 10 },
      series: [{
        type: 'graph', layout: 'force', roam: true,
        categories: [{ name: '风' }, { name: '风型' }, { name: '情感' }],
        force: { repulsion: 200, edgeLength: [80, 160] },
        label: { show: true, fontSize: 11 },
        lineStyle: { color: 'source', curveness: 0.1, opacity: 0.5 },
        data: nodes.length > 0 ? nodes : [{ name: '暂无数据', symbolSize: 30 }],
        links,
      }],
    };
  }, [naturePoems]);

  // 3. Sankey: 作者 -> 风型 -> 情感
  const sankeyOption = useMemo(() => {
    const nodes: { name: string }[] = [];
    const links: { source: string; target: string; value: number }[] = [];
    const nodeSet = new Set<string>();
    const linkMap: Record<string, number> = {};

    naturePoems.forEach(p => {
      const author = p.author;
      const st = p.humanOverride?.windSubtype || p.analysis?.windSubtype || '其他';
      const sentiment = p.humanOverride?.sentiment || p.analysis?.sentiment || '其他';

      const authorName = `${author}(作者)`;
      const stName = `${st}(风型)`;
      const sName = `${sentiment}(情感)`;

      [authorName, stName, sName].forEach(n => {
        if (!nodeSet.has(n)) { nodeSet.add(n); nodes.push({ name: n }); }
      });

      const key1 = `${authorName}||${stName}`;
      linkMap[key1] = (linkMap[key1] || 0) + 1;
      const key2 = `${stName}||${sName}`;
      linkMap[key2] = (linkMap[key2] || 0) + 1;
    });

    Object.entries(linkMap).forEach(([key, value]) => {
      const [source, target] = key.split('||');
      links.push({ source, target, value });
    });

    // Limit to top authors
    const authorCounts: Record<string, number> = {};
    naturePoems.forEach(p => { authorCounts[p.author] = (authorCounts[p.author] || 0) + 1; });
    const topAuthors = new Set(
      Object.entries(authorCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(a => `${a[0]}(作者)`)
    );

    const filteredNodes = nodes.filter(n => !n.name.endsWith('(作者)') || topAuthors.has(n.name));
    const filteredNodeNames = new Set(filteredNodes.map(n => n.name));
    const filteredLinks = links.filter(l => filteredNodeNames.has(l.source) && filteredNodeNames.has(l.target));

    return {
      tooltip: { trigger: 'item' as const },
      series: [{
        type: 'sankey',
        data: filteredNodes.length > 0 ? filteredNodes : [{ name: '暂无数据' }],
        links: filteredLinks,
        lineStyle: { color: 'gradient', curveness: 0.5 },
        label: { fontSize: 10 },
        nodeWidth: 20,
        nodeGap: 12,
      }],
    };
  }, [naturePoems]);

  // 4. Timeline: 按卷序排列情感脉络
  const timelineOption = useMemo(() => {
    const sorted = [...naturePoems]
      .filter(p => p.analysis?.sentiment)
      .slice(0, 100);

    const categories = [...new Set(sorted.map(p => p.analysis?.sentiment || '其他'))];
    const categoryColors: Record<string, string> = {};
    const palette = ['#338564', '#4fa27e', '#e8a838', '#c9544d', '#5b7fb8',
                     '#9a5fa3', '#7dbfa2', '#524a41', '#e07e3c', '#266b50'];
    categories.forEach((c, i) => { categoryColors[c] = palette[i % palette.length]; });

    return {
      tooltip: {
        trigger: 'item' as const,
        formatter: (p: any) => `《${p.data.title}》${p.data.author}<br/>情感: ${p.data.sentiment}<br/>强度: ${p.data.intensity}/5`,
      },
      grid: { left: 60, right: 20, top: 30, bottom: 40 },
      xAxis: {
        type: 'category' as const,
        data: sorted.map((_, i) => i + 1),
        axisLabel: { fontSize: 10 },
        name: '序号',
      },
      yAxis: {
        type: 'value' as const,
        min: 0, max: 5,
        name: '情感强度',
      },
      series: [{
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        data: sorted.map((p, i) => ({
          value: p.analysis?.sentimentIntensity || 3,
          title: p.title,
          author: p.author,
          sentiment: p.analysis?.sentiment || '其他',
          intensity: p.analysis?.sentimentIntensity || 3,
          itemStyle: { color: categoryColors[p.analysis?.sentiment || '其他'] },
        })),
        lineStyle: { color: '#7dbfa2', width: 2 },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(79,162,126,0.3)' },
            { offset: 1, color: 'rgba(79,162,126,0.02)' },
          ],
        }},
      }],
    };
  }, [naturePoems]);

  // 5. Treemap
  const treemapOption = useMemo(() => {
    const tree: Record<string, Record<string, number>> = {};
    naturePoems.forEach(p => {
      const st = p.humanOverride?.windSubtype || p.analysis?.windSubtype || '其他';
      const s = p.humanOverride?.sentiment || p.analysis?.sentiment || '其他';
      if (!tree[st]) tree[st] = {};
      tree[st][s] = (tree[st][s] || 0) + 1;
    });

    const data = Object.entries(tree).map(([name, children]) => ({
      name,
      children: Object.entries(children).map(([cname, value]) => ({ name: cname, value })),
    }));

    return {
      tooltip: { formatter: '{b}: {c}首' },
      series: [{
        type: 'treemap',
        data: data.length > 0 ? data : [{ name: '暂无数据', value: 1 }],
        label: { show: true, fontSize: 11 },
        levels: [
          { itemStyle: { borderColor: '#fff', borderWidth: 3, gapWidth: 3 } },
          { itemStyle: { borderColor: '#f5f3f0', borderWidth: 1 }, colorSaturation: [0.35, 0.65] },
        ],
      }],
    };
  }, [naturePoems]);

  // 6. Scatter: 情感强度 vs 风型
  const scatterOption = useMemo(() => {
    const subtypes = [...new Set(naturePoems.map(p => p.humanOverride?.windSubtype || p.analysis?.windSubtype || '其他'))];
    const sentiments = [...new Set(naturePoems.map(p => p.humanOverride?.sentiment || p.analysis?.sentiment || '其他'))];

    const data = naturePoems
      .filter(p => p.analysis?.sentiment && p.analysis?.windSubtype)
      .map(p => ({
        value: [
          subtypes.indexOf(p.analysis!.windSubtype || '其他'),
          sentiments.indexOf(p.analysis!.sentiment || '其他'),
          p.analysis!.sentimentIntensity || 3,
        ],
        title: p.title,
        author: p.author,
      }));

    return {
      tooltip: {
        formatter: (p: any) => `《${p.data.title}》${p.data.author}<br/>${subtypes[p.data.value[0]]} × ${sentiments[p.data.value[1]]}<br/>强度: ${p.data.value[2]}`,
      },
      grid: { left: 70, right: 20, top: 10, bottom: 60 },
      xAxis: { type: 'category' as const, data: subtypes, axisLabel: { fontSize: 10, rotate: 30 } },
      yAxis: { type: 'category' as const, data: sentiments, axisLabel: { fontSize: 10 } },
      series: [{
        type: 'scatter',
        data,
        symbolSize: (val: number[]) => val[2] * 8,
        itemStyle: { color: '#4fa27e', opacity: 0.7 },
      }],
    };
  }, [naturePoems]);

  const charts: Record<ChartType, { label: string; option: any }> = {
    wordcloud: { label: '意象词云', option: wordcloudOption },
    network: { label: '关联网络', option: networkOption },
    sankey: { label: '桑基图', option: sankeyOption },
    timeline: { label: '情感脉络', option: timelineOption },
    treemap: { label: '矩形树图', option: treemapOption },
    scatter: { label: '情感散点', option: scatterOption },
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink-800">可视化</h2>
          <p className="text-ink-400 text-sm mt-1">
            多维度可视化自然意象"风"的情感脉络（{naturePoems.length} 首自然意象诗）
          </p>
        </div>
        <button onClick={exportImage} className="btn-secondary flex items-center gap-1.5">
          <Camera className="w-4 h-4" /> 导出图片
        </button>
      </div>

      {/* Chart type selector */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(charts).map(([key, { label }]) => (
          <button
            key={key}
            onClick={() => setChartType(key as ChartType)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              chartType === key
                ? 'bg-wind-600 text-white shadow-sm'
                : 'bg-white border border-ink-200 text-ink-600 hover:border-wind-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="card">
        <ReactECharts
          ref={chartRef}
          option={charts[chartType].option}
          style={{ height: 500 }}
          notMerge={true}
        />
      </div>
    </div>
  );
}
