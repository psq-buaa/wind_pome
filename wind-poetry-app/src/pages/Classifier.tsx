import { useState, useCallback, useRef } from 'react';
import { useStore } from '../store';
import { analyzeSinglePoem } from '../ai';
import type { PoemEntry, WindType, AnalysisResult } from '../types';
import { Play, Pause, CheckCircle, XCircle, Eye, Zap, Filter } from 'lucide-react';

export default function Classifier() {
  const poems = useStore((s) => s.poems);
  const updatePoem = useStore((s) => s.updatePoem);
  const apiProvider = useStore((s) => s.apiProvider);
  const batchProgress = useStore((s) => s.batchProgress);
  const setBatchProgress = useStore((s) => s.setBatchProgress);
  const setCurrentPage = useStore((s) => s.setCurrentPage);

  const [viewFilter, setViewFilter] = useState<'all' | 'pending' | 'nature' | 'non-nature' | 'reviewed'>('all');
  const [detailPoem, setDetailPoem] = useState<PoemEntry | null>(null);
  const pauseRef = useRef(false);

  const getWindType = (p: PoemEntry): WindType | 'pending' =>
    p.humanOverride?.windType || p.analysis?.windType || 'pending';

  const filtered = poems.filter(p => {
    if (viewFilter === 'all') return true;
    if (viewFilter === 'reviewed') return p.humanReviewed;
    return getWindType(p) === viewFilter;
  });

  // 批量 AI 分类
  const runBatchClassify = useCallback(async () => {
    if (!apiProvider) {
      alert('请先在"设置"中配置 API 密钥');
      setCurrentPage('settings');
      return;
    }
    const pending = poems.filter(p => !p.analysis);
    if (pending.length === 0) {
      alert('所有诗句已分析完成');
      return;
    }

    pauseRef.current = false;
    setBatchProgress({ total: pending.length, completed: 0, status: 'running', errors: [] });

    for (let i = 0; i < pending.length; i++) {
      if (pauseRef.current) {
        setBatchProgress({ status: 'paused' });
        return;
      }

      const p = pending[i];
      setBatchProgress({ current: `${p.title} - ${p.halfLine || ''}`, completed: i });

      try {
        const result = await analyzeSinglePoem(
          apiProvider,
          p.halfLine || '',
          p.content,
        );
        updatePoem(p.id, p.halfLine, { analysis: result });
      } catch (err) {
        setBatchProgress({
          errors: [...(batchProgress.errors || []),
            `${p.id}: ${err instanceof Error ? err.message : String(err)}`],
        });
        // 短暂延迟后继续
        await new Promise(r => setTimeout(r, 1000));
      }

      // 请求间隔
      await new Promise(r => setTimeout(r, 500));
    }

    setBatchProgress({ completed: pending.length, status: 'done', current: '' });
  }, [apiProvider, poems, updatePoem, setBatchProgress, batchProgress.errors, setCurrentPage]);

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

  const pendingCount = poems.filter(p => !p.analysis).length;
  const progressPct = batchProgress.total > 0
    ? Math.round((batchProgress.completed / batchProgress.total) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink-800">风意象分类</h2>
          <p className="text-ink-400 text-sm mt-1">
            AI 自动判断"风"是否为自然意象，支持人工审核纠正
          </p>
        </div>
        <div className="flex gap-2">
          {batchProgress.status === 'running' ? (
            <button onClick={() => { pauseRef.current = true; }} className="btn-secondary flex items-center gap-1.5">
              <Pause className="w-4 h-4" /> 暂停
            </button>
          ) : (
            <button onClick={runBatchClassify} disabled={pendingCount === 0}
              className="btn-primary flex items-center gap-1.5">
              <Zap className="w-4 h-4" />
              {pendingCount > 0 ? `AI分类 (${pendingCount}条待分析)` : '全部已分析'}
            </button>
          )}
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
      <div className="flex gap-2">
        {[
          { key: 'all', label: '全部' },
          { key: 'pending', label: '待分析' },
          { key: 'nature', label: '自然意象' },
          { key: 'non-nature', label: '非自然' },
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
                poems.filter(p => getWindType(p) === tab.key).length})
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.slice(0, 100).map((p, i) => {
          const wt = getWindType(p);
          return (
            <div key={`${p.id}_${p.halfLine}_${i}`}
              className="card flex items-center gap-4 !py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-700">{p.title}</span>
                  <span className="text-ink-400 text-xs">—— {p.author}</span>
                  {p.humanReviewed && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">已审核</span>
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
        {filtered.length > 100 && (
          <p className="text-center text-ink-400 text-xs py-2">显示前 100 条，共 {filtered.length} 条</p>
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
