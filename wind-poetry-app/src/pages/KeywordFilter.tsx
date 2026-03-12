import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { poemMatchesKeyword, getEffectiveWindType } from '../types';
import type { PoemEntry } from '../types';
import { Plus, X, Tag, Download, Eye, Search } from 'lucide-react';

export default function KeywordFilter() {
  const poems = useStore(s => s.poems);
  const keywords = useStore(s => s.nonNatureKeywords);
  const addKeyword = useStore(s => s.addKeyword);
  const removeKeyword = useStore(s => s.removeKeyword);

  const [newKeyword, setNewKeyword] = useState('');
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailPoem, setDetailPoem] = useState<PoemEntry | null>(null);

  // 每个关键词匹配的诗歌数量
  const keywordCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    keywords.forEach(kw => {
      counts[kw] = poems.filter(p => poemMatchesKeyword(p, kw)).length;
    });
    return counts;
  }, [poems, keywords]);

  // 被关键词过滤为非自然的诗歌总数（不含已有AI/人工分析的）
  const keywordFilteredCount = useMemo(() => {
    return poems.filter(p => {
      const { source } = getEffectiveWindType(p, keywords);
      return source === 'keyword';
    }).length;
  }, [poems, keywords]);

  // 当前选中关键词匹配的诗歌
  const matchedPoems = useMemo(() => {
    if (!activeKeyword) return [];
    return poems.filter(p => poemMatchesKeyword(p, activeKeyword));
  }, [poems, activeKeyword]);

  // 搜索过滤
  const filteredKeywords = searchQuery
    ? keywords.filter(kw => kw.includes(searchQuery))
    : keywords;

  function handleAddKeyword() {
    const kw = newKeyword.trim();
    if (!kw) return;
    // 支持用户粘贴"、"或换行分隔的多个关键词
    const parts = kw.split(/[、，,\n\r]+/).map(s => s.trim()).filter(Boolean);
    parts.forEach(p => addKeyword(p));
    setNewKeyword('');
  }

  function handleRemoveKeyword(kw: string) {
    if (activeKeyword === kw) setActiveKeyword(null);
    removeKeyword(kw);
  }

  // 导出关键词为 JSON
  function exportKeywords() {
    const blob = new Blob([JSON.stringify(keywords, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'non_nature_keywords.json';
    a.click();
    URL.revokeObjectURL(url);
    alert('已导出关键词列表。\n放入 public/data/non_nature_keywords.json 即可团队共享。');
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink-800">关键词过滤</h2>
          <p className="text-ink-400 text-sm mt-1">
            通过非自然意象关键词快速批量过滤诗句 · 当前过滤
            <span className="font-semibold text-wind-600 mx-1">{keywordFilteredCount}</span>条
          </p>
        </div>
        <button onClick={exportKeywords} className="btn-secondary flex items-center gap-1.5">
          <Download className="w-4 h-4" />
          导出关键词
        </button>
      </div>

      {/* 添加关键词 */}
      <div className="card">
        <h3 className="text-sm font-semibold text-ink-700 mb-3">添加关键词</h3>
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-2 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-wind-400"
            placeholder="输入关键词（可用 、或换行分隔多个）"
            value={newKeyword}
            onChange={e => setNewKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddKeyword()}
          />
          <button onClick={handleAddKeyword} className="btn-primary flex items-center gap-1">
            <Plus className="w-4 h-4" /> 添加
          </button>
        </div>
        <p className="text-xs text-ink-400 mt-2">
          含有这些关键词的诗句将自动标记为非自然意象（人工审核和AI分析优先级更高）
        </p>
      </div>

      {/* 搜索关键词 */}
      {keywords.length > 20 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
          <input
            className="w-full pl-10 pr-4 py-2 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-wind-400"
            placeholder="搜索关键词..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {/* 关键词标签云 */}
      <div className="card">
        <h3 className="text-sm font-semibold text-ink-700 mb-3">
          关键词列表 ({keywords.length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {filteredKeywords.map(kw => (
            <div
              key={kw}
              className={`group inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors ${
                activeKeyword === kw
                  ? 'bg-wind-600 text-white'
                  : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              }`}
              onClick={() => setActiveKeyword(activeKeyword === kw ? null : kw)}
            >
              <Tag className="w-3 h-3" />
              {kw}
              <span className={`text-xs ml-0.5 ${activeKeyword === kw ? 'text-white/70' : 'text-ink-400'}`}>
                ({keywordCounts[kw] || 0})
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleRemoveKeyword(kw); }}
                className={`ml-0.5 p-0.5 rounded-full transition-colors ${
                  activeKeyword === kw
                    ? 'hover:bg-white/20'
                    : 'opacity-0 group-hover:opacity-100 hover:bg-ink-300/30'
                }`}
                title="删除关键词"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {filteredKeywords.length === 0 && (
            <p className="text-ink-400 text-sm">暂无关键词</p>
          )}
        </div>
      </div>

      {/* 匹配的诗歌列表 */}
      {activeKeyword && (
        <div className="card">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">
            含"{activeKeyword}"的诗句 ({matchedPoems.length})
          </h3>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {matchedPoems.slice(0, 200).map((p, i) => {
              const { type, source } = getEffectiveWindType(p, keywords);
              return (
                <div key={`${p.id}_${p.halfLine}_${i}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-ink-50 hover:bg-ink-100 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink-700 text-sm">{p.title}</span>
                      <span className="text-ink-400 text-xs">—— {p.author}</span>
                    </div>
                    <p className="text-ink-600 text-sm mt-0.5 truncate">
                      {highlightKeyword(p.halfLine || p.content.slice(0, 80), activeKeyword)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {type === 'nature' && <span className="tag-nature">自然</span>}
                    {type === 'non-nature' && (
                      <span className="tag-non-nature">
                        非自然{source === 'keyword' ? '(词)' : source === 'ai' ? '(AI)' : ''}
                      </span>
                    )}
                    {type === 'pending' && <span className="tag-pending">待分析</span>}
                    <button onClick={() => setDetailPoem(p)}
                      className="p-1 rounded hover:bg-ink-200 text-ink-400">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            {matchedPoems.length > 200 && (
              <p className="text-center text-ink-400 text-xs py-2">显示前200条，共{matchedPoems.length}条</p>
            )}
          </div>
        </div>
      )}

      {/* 诗歌详情弹窗 */}
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
            <button onClick={() => setDetailPoem(null)} className="mt-4 btn-secondary w-full">关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}

// 高亮关键词
function highlightKeyword(text: string, keyword: string) {
  if (!text || !keyword) return text;
  const idx = text.indexOf(keyword);
  if (idx < 0) return text;
  return (
    <span>
      {text.slice(0, idx)}
      <span className="bg-yellow-200 text-yellow-800 px-0.5 rounded">{keyword}</span>
      {text.slice(idx + keyword.length)}
    </span>
  );
}
