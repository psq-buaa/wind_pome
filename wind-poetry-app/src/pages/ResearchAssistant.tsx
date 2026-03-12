import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { generateResearchReport, RESEARCH_TOPICS } from '../ai';
import { getEffectiveWindType } from '../types';
import type { ResearchReport } from '../types';
import { BookOpen, Sparkles, Trash2, Download, Copy, Loader2 } from 'lucide-react';

export default function ResearchAssistant() {
  const poems = useStore(s => s.poems);
  const keywords = useStore(s => s.nonNatureKeywords);
  const apiProvider = useStore(s => s.apiProvider);
  const setCurrentPage = useStore(s => s.setCurrentPage);
  const reports = useStore(s => s.researchReports);
  const addReport = useStore(s => s.addResearchReport);
  const deleteReport = useStore(s => s.deleteResearchReport);

  const [selectedTopic, setSelectedTopic] = useState('overview');
  const [customTopic, setCustomTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [viewReport, setViewReport] = useState<ResearchReport | null>(null);

  const stats = useMemo(() => {
    const analyzed = poems.filter(p => getEffectiveWindType(p, keywords).source !== 'none');
    const nature = poems.filter(p => getEffectiveWindType(p, keywords).type === 'nature');
    const nonNature = poems.filter(p => getEffectiveWindType(p, keywords).type === 'non-nature');
    const sentimentDist: Record<string, number> = {};
    const subtypeDist: Record<string, number> = {};
    const authorCount: Record<string, number> = {};
    nature.forEach(p => {
      const s = p.analysis?.sentiment || p.humanOverride?.sentiment;
      if (s) sentimentDist[s] = (sentimentDist[s] || 0) + 1;
      const st = p.analysis?.windSubtype || p.humanOverride?.windSubtype;
      if (st) subtypeDist[st] = (subtypeDist[st] || 0) + 1;
    });
    poems.forEach(p => { authorCount[p.author] = (authorCount[p.author] || 0) + 1; });
    const topAuthors = Object.entries(authorCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    return { total: poems.length, analyzed: analyzed.length, nature: nature.length, nonNature: nonNature.length, sentimentDist, subtypeDist, topAuthors };
  }, [poems, keywords]);

  async function handleGenerate() {
    if (!apiProvider) { alert('请先在"设置"中配置 API 密钥'); setCurrentPage('settings'); return; }
    if (selectedTopic === 'custom' && !customTopic.trim()) { alert('请输入自定义研究主题'); return; }
    setGenerating(true);
    try {
      const naturePoems = poems.filter(p => getEffectiveWindType(p, keywords).type === 'nature' && p.analysis);
      const samplePoems = naturePoems.slice(0, 30).map(p => ({
        title: p.title, author: p.author, halfLine: p.halfLine || p.content.slice(0, 40),
        sentiment: p.analysis?.sentiment, windSubtype: p.analysis?.windSubtype,
      }));
      const content = await generateResearchReport(apiProvider, selectedTopic, customTopic, stats, samplePoems);
      const report: ResearchReport = {
        id: `report_${Date.now()}`,
        topic: selectedTopic === 'custom' ? customTopic : RESEARCH_TOPICS.find(t => t.id === selectedTopic)?.name || selectedTopic,
        content, generatedAt: new Date().toISOString(),
        dataSnapshot: { totalPoems: stats.total, analyzedCount: stats.analyzed, natureCount: stats.nature, nonNatureCount: stats.nonNature },
      };
      addReport(report);
      setViewReport(report);
    } catch (err) { alert('生成失败: ' + (err instanceof Error ? err.message : String(err))); }
    setGenerating(false);
  }

  function exportReport(r: ResearchReport) {
    const blob = new Blob([r.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${r.topic}_${r.generatedAt.slice(0, 10)}.md`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportAllReports() {
    if (reports.length === 0) return;
    const blob = new Blob([JSON.stringify(reports, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'research_reports.json'; a.click();
    URL.revokeObjectURL(url);
    alert('已导出。放入 public/data/research_reports.json 即团队共享。');
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => alert('已复制'));
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink-800">研究助手</h2>
          <p className="text-ink-400 text-sm mt-1">基于分析数据生成学术研究报告 · 已有 {reports.length} 份报告</p>
        </div>
        {reports.length > 0 && (
          <button onClick={exportAllReports} className="btn-secondary flex items-center gap-1.5">
            <Download className="w-4 h-4" /> 导出全部报告
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '总诗句', value: stats.total, color: 'text-ink-700' },
          { label: '已分析', value: stats.analyzed, color: 'text-blue-600' },
          { label: '自然意象', value: stats.nature, color: 'text-green-600' },
          { label: '非自然', value: stats.nonNature, color: 'text-orange-600' },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
            <p className="text-xs text-ink-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-ink-700 mb-3">生成新报告</h3>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {RESEARCH_TOPICS.map(t => (
            <button key={t.id} onClick={() => setSelectedTopic(t.id)}
              className={`p-3 rounded-lg text-left text-sm transition-colors ${
                selectedTopic === t.id ? 'bg-wind-50 border-2 border-wind-400' : 'bg-ink-50 border-2 border-transparent hover:bg-ink-100'
              }`}>
              <span className="font-medium text-ink-700">{t.name}</span>
              <p className="text-xs text-ink-400 mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
        {selectedTopic === 'custom' && (
          <input className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm mb-3 focus:outline-none focus:border-wind-400"
            placeholder="输入自定义研究主题..." value={customTopic} onChange={e => setCustomTopic(e.target.value)} />
        )}
        <button onClick={handleGenerate} disabled={generating || stats.analyzed === 0}
          className="btn-primary flex items-center gap-1.5">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? '生成中...' : stats.analyzed === 0 ? '请先分析数据' : '生成报告'}
        </button>
      </div>

      {reports.length > 0 && !viewReport && (
        <div className="card">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">历史报告</h3>
          <div className="space-y-2">
            {reports.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 bg-ink-50 rounded-lg hover:bg-ink-100">
                <BookOpen className="w-4 h-4 text-wind-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-ink-700 text-sm">{r.topic}</span>
                  <span className="text-ink-400 text-xs ml-2">{new Date(r.generatedAt).toLocaleString('zh-CN')}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setViewReport(r)} className="p-1.5 rounded hover:bg-ink-200 text-ink-500 text-xs">查看</button>
                  <button onClick={() => exportReport(r)} className="p-1.5 rounded hover:bg-ink-200 text-ink-500"><Download className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { if (confirm('删除？')) deleteReport(r.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewReport && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-ink-800">{viewReport.topic}</h3>
              <p className="text-xs text-ink-400">{new Date(viewReport.generatedAt).toLocaleString('zh-CN')}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => copyToClipboard(viewReport.content)} className="btn-secondary flex items-center gap-1 text-xs"><Copy className="w-3.5 h-3.5" /> 复制</button>
              <button onClick={() => exportReport(viewReport)} className="btn-secondary flex items-center gap-1 text-xs"><Download className="w-3.5 h-3.5" /> 导出</button>
              <button onClick={() => setViewReport(null)} className="btn-secondary text-xs">关闭</button>
            </div>
          </div>
          <div className="prose prose-sm max-w-none text-ink-700 leading-relaxed whitespace-pre-wrap">{viewReport.content}</div>
        </div>
      )}
    </div>
  );
}
