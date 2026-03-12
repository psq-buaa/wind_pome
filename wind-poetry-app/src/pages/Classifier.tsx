import { useState, useCallback, useRef, useMemo } from 'react';
import { useStore } from '../store';
import { analyzeSinglePoem } from '../ai';
import { getEffectiveWindType } from '../types';
import type { PoemEntry, WindType } from '../types';
import { Pause, CheckCircle, XCircle, Eye, Zap, Square, CheckSquare, Download } from 'lucide-react';

const poemKey = (p: PoemEntry) => `${p.id}__${p.halfLine || ''}`;

export default function Classifier() {
  const poems = useStore(s => s.poems);
  const updatePoem = useStore(s => s.updatePoem);
  const apiProvider = useStore(s => s.apiProvider);
  const batchProgress = useStore(s => s.batchProgress);
  const setBatchProgress = useStore(s => s.setBatchProgress);
  const setCurrentPage = useStore(s => s.setCurrentPage);
  const keywords = useStore(s => s.nonNatureKeywords);
  const selectedKeys = useStore(s => s.selectedPoemKeys);
  const toggleSelection = useStore(s => s.togglePoemSelection);
  const setSelectedKeys = useStore(s => s.setSelectedPoemKeys);

  const [viewFilter, setViewFilter] = useState<'all' | 'pending' | 'nature' | 'non-nature' | 'reviewed' | 'keyword'>('all');
  const [detailPoem, setDetailPoem] = useState<PoemEntry | null>(null);
  const [batchSize, setBatchSize] = useState(20);
  const pauseRef = useRef(false);

  const getWT = (p: PoemEntry) => getEffectiveWindType(p, keywords);

  const filtered = useMemo(() => poems.filter(p => {
    const { type, source } = getWT(p);
    if (viewFilter === 'all') return true;
    if (viewFilter === 'reviewed') return p.humanReviewed;
    if (viewFilter === 'keyword') return source === 'keyword';
    return type === viewFilter;
  }), [poems, viewFilter, keywords]);

  // 批量 AI 分类（支持选中条目或待分析条目）
  const runBatchClassify = useCallback(async (targets?: PoemEntry[]) => {
    if (!apiProvider) {
      alert('请先在"设置"中配置 API 密钥');
      setCurrentPage('settings');
      return;
    }
    const pending = targets || poems.filter(p => !p.analysis && !p.humanReviewed);
    const batch = pending.slice(0, batchSize);
    if (batch.length === 0) {
      alert(targets ? '所选条目均已分析' : '无待分析条目');
      return;
    }

    pauseRef.current = false;
    setBatchProgress({ total: batch.length, completed: 0, status: 'running', errors: [] });

    for (let i = 0; i < batch.length; i++) {
      if (pauseRef.current) { setBatchProgress({ status: 'paused' }); return; }
      const p = batch[i];
      setBatchProgress({ current: `${p.title} - ${p.halfLine || ''}`, completed: i });
      try {
        const result = await analyzeSinglePoem(apiProvider, p.halfLine || '', p.content);
        updatePoem(p.id, p.halfLine, { analysis: result });
      } catch (err) {
        setBatchProgress({
          errors: [...(batchProgress.errors || []),
            `${p.id}: ${err instanceof Error ? err.message : String(err)}`],
        });
        await new Promise(r => setTimeout(r, 1000));
      }
      await new Promise(r => setTimeout(r, 500));
    }
    setBatchProgress({ completed: batch.length, status: 'done', current: '' });
    setSelectedKeys([]);
  }, [apiProvider, poems, batchSize, updatePoem, setBatchProgress, batchProgress.errors, setCurrentPage, setSelectedKeys]);

  // 分析选中的条目
  const runSelectedClassify = useCallback(() => {
    const targets = poems.filter(p => selectedKeys.includes(poemKey(p)));
    runBatchClassify(targets);
  }, [poems, selectedKeys, runBatchClassify]);

  // 人工审核
  function handleHumanReview(poem: PoemEntry, windType: WindType) {
    updatePoem(poem.id, poem.halfLine, {
      humanReviewed: true,
      humanOverride: {
        ...(poem.humanOverride || {}),
        windType,
      },
    });
  }

  const pendingCount = poems.filter(p => !p.analysis && !p.humanReviewed).length;
  const progressPct = batchProgress.total > 0
    ? Math.round((batchProgress.completed / batchProgress.total) * 100) : 0;

  // 导出分析结果为JSON（共享到 public/data/）
  function exportAnalysis() {
    const analyzed = poems.filter(p => p.analysis || p.humanReviewed);
    if (analyzed.length === 0) { alert('暂无分析结果'); return; }
    const cache = analyzed.map(p => ({
      key: poemKey(p), analysis: p.analysis,
      humanReviewed: p.humanReviewed, humanOverride: p.humanOverride,
    }));
    const blob = new Blob([JSON.stringify(cache, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'analysis_cache.json'; a.click();
    URL.revokeObjectURL(url);
    alert(`已导出 ${analyzed.length} 条。放入 public/data/ 即团队共享。`);
  }

  // 全选/取消当前页
  function toggleSelectAll() {
    const pageKeys = filtered.slice(0, 200).map(p => poemKey(p));
    const allSelected = pageKeys.every(k => selectedKeys.includes(k));
    if (allSelected) {
      setSelectedKeys(selectedKeys.filter(k => !pageKeys.includes(k)));
    } else {
      setSelectedKeys([...new Set([...selectedKeys, ...pageKeys])]);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink-800">风意象分类</h2>
          <p className="text-ink-400 text-sm mt-1">
            AI 自动判断+人工审核 · 支持多选批量分析
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {/* 批量大小选择 */}
          <label className="text-xs text-ink-500">批量数:</label>
          <select value={batchSize} onChange={e => setBatchSize(Number(e.target.value))}
            className="px-2 py-1.5 border border-ink-200 rounded-lg text-sm">
            {[10, 20, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
          </select>

          {batchProgress.status === 'running' ? (
            <button onClick={() => { pauseRef.current = true; }} className="btn-secondary flex items-center gap-1.5">
              <Pause className="w-4 h-4" /> 暂停
            </button>
          ) : (
            <>
              {selectedKeys.length > 0 && (
                <button onClick={runSelectedClassify} className="btn-primary flex items-center gap-1.5">
                  <Zap className="w-4 h-4" />
                  分析选中 ({selectedKeys.length})
                </button>
              )}
              <button onClick={() => runBatchClassify()} disabled={pendingCount === 0}
                className="btn-primary flex items-center gap-1.5">
                <Zap className="w-4 h-4" />
                批量AI分析 ({Math.min(pendingCount, batchSize)})
              </button>
            </>
          )}
          <button onClick={exportAnalysis} className="btn-secondary flex items-center gap-1.5">
            <Download className="w-4 h-4" /> 导出
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {batchProgress.status !== 'idle' && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-ink-600">
              {batchProgress.status === 'running' && `正在分析: ${batchProgress.current}`}
              {batchProgress.status === 'paused' && '已暂停'}
              {batchProgress.status === 'done' && '分析完成'}
            </span>
            <span className="text-sm font-mono text-ink-500">{batchProgress.completed}/{batchProgress.total}</span>
          </div>
          <div className="w-full bg-ink-100 rounded-full h-2">
            <div className="bg-wind-500 h-2 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          {batchProgress.errors.length > 0 && (
            <p className="text-xs text-red-500 mt-2">
              {batchProgress.errors.length} 个错误
            </p>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 items-center">
        <button onClick={toggleSelectAll} className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-400" title="全选/取消">
          {filtered.slice(0, 200).every(p => selectedKeys.includes(poemKey(p)))
            ? <CheckSquare className="w-4 h-4 text-wind-600" />
            : <Square className="w-4 h-4" />}
        </button>
        {[
          { key: 'all', label: '全部' },
          { key: 'pending', label: '待分析' },
          { key: 'nature', label: '自然意象' },
          { key: 'non-nature', label: '非自然' },
          { key: 'keyword', label: '关键词过滤' },
          { key: 'reviewed', label: '已审核' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setViewFilter(tab.key as any)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              viewFilter === tab.key
                ? 'bg-wind-600 text-white'
                : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
            }`}
          >
            {tab.label}
            <span className="ml-1 opacity-70">
              ({tab.key === 'all' ? poems.length :
                tab.key === 'reviewed' ? poems.filter(p => p.humanReviewed).length :
                tab.key === 'keyword' ? poems.filter(p => getWT(p).source === 'keyword').length :
                poems.filter(p => getWT(p).type === tab.key).length})
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.slice(0, 200).map((p, i) => {
          const { type: wt, source } = getWT(p);
          const key = poemKey(p);
          const selected = selectedKeys.includes(key);
          return (
            <div key={`${p.id}_${p.halfLine}_${i}`}
              className={`card flex items-center gap-4 !py-3 ${selected ? 'ring-2 ring-wind-400' : ''}`}>
              {/* 复选框 */}
              <button onClick={() => toggleSelection(key)} className="shrink-0">
                {selected
                  ? <CheckSquare className="w-4 h-4 text-wind-600" />
                  : <Square className="w-4 h-4 text-ink-300" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-700">{p.title}</span>
                  <span className="text-ink-400 text-xs">—— {p.author}</span>
                  {p.humanReviewed && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">已审核</span>
                  )}
                  {source === 'keyword' && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded">关键词</span>
                  )}
                </div>
                <p className="text-ink-600 text-sm mt-0.5 truncate">
                  {p.halfLine ? `"${p.halfLine}"` : p.content.slice(0, 60) + '...'}
                </p>
                {p.analysis?.windTypeReason && (
                  <p className="text-ink-400 text-xs mt-1">AI: {p.analysis.windTypeReason}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {wt === 'nature' && <span className="tag-nature">自然意象</span>}
                {wt === 'non-nature' && <span className="tag-non-nature">非自然</span>}
                {wt === 'pending' && <span className="tag-pending">待分析</span>}

                {/* 审核按钮 */}
                <button onClick={() => handleHumanReview(p, 'nature')}
                  title="标记为自然意象"
                  className={`p-1.5 rounded-lg transition-colors ${
                    p.humanOverride?.windType === 'nature' ? 'bg-green-100 text-green-600' : 'hover:bg-green-50 text-ink-300'
                  }`}>
                  <CheckCircle className="w-4 h-4" />
                </button>
                <button onClick={() => handleHumanReview(p, 'non-nature')}
                  title="标记为非自然意象"
                  className={`p-1.5 rounded-lg transition-colors ${
                    p.humanOverride?.windType === 'non-nature' ? 'bg-red-100 text-red-600' : 'hover:bg-red-50 text-ink-300'
                  }`}>
                  <XCircle className="w-4 h-4" />
                </button>
                <button onClick={() => setDetailPoem(p)}
                  className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-400">
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length > 200 && (
          <p className="text-center text-ink-400 text-xs py-2">显示前 200 条，共 {filtered.length} 条</p>
        )}
      </div>

      {/* Detail modal */}
      {detailPoem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setDetailPoem(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-ink-800">《{detailPoem.title}》</h3>
            <p className="text-ink-500 text-sm">{detailPoem.author}</p>
            {detailPoem.halfLine && (
              <p className="mt-3 text-wind-600 font-medium">含风半联："{detailPoem.halfLine}"</p>
            )}
            <div className="mt-3 p-4 bg-ink-50 rounded-lg text-ink-700 text-sm leading-relaxed whitespace-pre-wrap">
              {detailPoem.content || '（无完整内容）'}
            </div>
            {detailPoem.analysis && (
              <div className="mt-4 space-y-2 text-sm">
                <h4 className="font-semibold text-ink-700">AI 分析结果</h4>
                <p><span className="text-ink-400">分类：</span>
                  {detailPoem.analysis.windType === 'nature' ? '自然意象' : '非自然意象'}
                  {detailPoem.analysis.nonNatureCategory && ` (${detailPoem.analysis.nonNatureCategory})`}
                </p>
                <p><span className="text-ink-400">理由：</span>{detailPoem.analysis.windTypeReason}</p>
                {detailPoem.analysis.windType === 'nature' && (
                  <>
                    <p><span className="text-ink-400">子类：</span>{detailPoem.analysis.windSubtype}</p>
                    <p><span className="text-ink-400">情感：</span>{detailPoem.analysis.sentiment}（强度 {detailPoem.analysis.sentimentIntensity}/5）</p>
                    <p><span className="text-ink-400">情感理由：</span>{detailPoem.analysis.sentimentReason}</p>
                    <p><span className="text-ink-400">意象描述：</span>{detailPoem.analysis.imageDescription}</p>
                    {detailPoem.analysis.keywords && detailPoem.analysis.keywords.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        <span className="text-ink-400">关键词：</span>
                        {detailPoem.analysis.keywords.map((k, i) => (
                          <span key={i} className="tag bg-wind-50 text-wind-600">{k}</span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            <button onClick={() => setDetailPoem(null)} className="mt-4 btn-secondary w-full">关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}
