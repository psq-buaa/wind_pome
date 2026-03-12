import { useState, useRef } from 'react';
import { useStore } from '../store';
import { loadBuiltinPoemData } from '../dataLoader';
import type { PoemEntry } from '../types';
import { Upload, FileJson, FileText, Trash2, Download, Search, Save } from 'lucide-react';

// 内置数据路径
const BUILTIN_DATA = [
  { name: '含风的半联', file: 'half_lines' },
  { name: '含风诗歌', file: 'full_poems' },
];

export default function DataManager() {
  const poems = useStore((s) => s.poems);
  const setPoems = useStore((s) => s.setPoems);
  const addPoems = useStore((s) => s.addPoems);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 加载内置数据
  async function loadBuiltinData() {
    setLoading(true);
    try {
      const entries = await loadBuiltinPoemData(poems);
      setPoems(entries);
    } catch (e) {
      alert('加载数据失败: ' + (e instanceof Error ? e.message : String(e)));
    }
    setLoading(false);
  }

  // 将分析结果保存为 JSON 文件（放入 public/data/ 即可内置）
  function saveAnalysisToFile() {
    const analyzed = poems.filter(p => p.analysis || p.humanReviewed);
    if (analyzed.length === 0) {
      alert('暂无分析结果可保存');
      return;
    }
    const cacheData = analyzed.map(p => ({
      key: `${p.id}__${p.halfLine || ''}`,
      analysis: p.analysis,
      humanReviewed: p.humanReviewed,
      humanOverride: p.humanOverride,
    }));
    const blob = new Blob([JSON.stringify(cacheData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analysis_cache.json';
    a.click();
    URL.revokeObjectURL(url);
    alert(`已导出 ${analyzed.length} 条分析结果。\n请将下载的 analysis_cache.json 放入项目的 public/data/ 目录中，\n下次加载内置数据即自动包含分析结果。`);
  }

  // 上传文件
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);

    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text);
        const entries = parseUploadedData(data);
        addPoems(entries);
      } else if (file.name.endsWith('.docx')) {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const entries = parseDocxText(result.value);
        addPoems(entries);
      } else {
        alert('支持 .json 和 .docx 格式');
      }
    } catch (err) {
      alert('文件解析失败: ' + (err instanceof Error ? err.message : String(err)));
    }
    setLoading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function parseUploadedData(data: any[]): PoemEntry[] {
    return data.map((item, i) => ({
      id: item.id || `uploaded_${Date.now()}_${i}`,
      title: item.title || '未知标题',
      author: item.author || '未知作者',
      content: item.content || item.half_line || '',
      halfLine: item.half_line,
      source: 'uploaded' as const,
      humanReviewed: false,
    }));
  }

  function parseDocxText(text: string): PoemEntry[] {
    // 简单按段落解析
    const lines = text.split('\n').filter(l => l.trim());
    const entries: PoemEntry[] = [];
    let current: Partial<PoemEntry> = {};

    for (const line of lines) {
      const titleMatch = line.match(/^[《【](.+?)[》】]/);
      if (titleMatch) {
        if (current.content) {
          entries.push({
            id: `docx_${Date.now()}_${entries.length}`,
            title: current.title || '未知标题',
            author: current.author || '未知作者',
            content: current.content,
            source: 'uploaded',
            humanReviewed: false,
          });
        }
        current = { title: titleMatch[1] };
      } else if (line.includes('作者') || line.includes('：')) {
        const authorMatch = line.match(/(?:作者[：:]?\s*)(.+)/);
        if (authorMatch) current.author = authorMatch[1].trim();
        else current.content = (current.content || '') + line;
      } else {
        current.content = (current.content || '') + line;
      }
    }
    if (current.content) {
      entries.push({
        id: `docx_${Date.now()}_${entries.length}`,
        title: current.title || '未知标题',
        author: current.author || '未知作者',
        content: current.content,
        source: 'uploaded',
        humanReviewed: false,
      });
    }
    return entries;
  }

  // 导出数据
  function exportData() {
    const json = JSON.stringify(poems, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wind_poems_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 筛选
  const filtered = searchQuery
    ? poems.filter(p =>
        p.title.includes(searchQuery) ||
        p.author.includes(searchQuery) ||
        p.halfLine?.includes(searchQuery) ||
        p.content.includes(searchQuery)
      )
    : poems;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink-800">数据管理</h2>
          <p className="text-ink-400 text-sm mt-1">加载、上传、浏览和导出诗歌数据</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadBuiltinData} disabled={loading} className="btn-primary flex items-center gap-1.5">
            <FileJson className="w-4 h-4" />
            {loading ? '加载中...' : '加载内置数据'}
          </button>
          <label className="btn-secondary flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-4 h-4" />
            上传文件
            <input ref={fileRef} type="file" accept=".json,.docx" onChange={handleFileUpload} className="hidden" />
          </label>
          {poems.length > 0 && (
            <>
              <button onClick={saveAnalysisToFile} className="btn-secondary flex items-center gap-1.5"
                title="将分析结果保存为 JSON，放入 public/data/ 即永久内置">
                <Save className="w-4 h-4" />
                保存分析到文件
              </button>
              <button onClick={exportData} className="btn-secondary flex items-center gap-1.5">
                <Download className="w-4 h-4" />
                导出
              </button>
              <button onClick={() => { if (confirm('确认清空所有数据？')) setPoems([]); }} className="btn-danger flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" />
                清空
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
          <input
            className="w-full pl-10 pr-4 py-2 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-wind-400"
            placeholder="搜索诗题、作者、内容..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-ink-500">
              <th className="pb-2 pr-4 font-medium">ID</th>
              <th className="pb-2 pr-4 font-medium">诗题</th>
              <th className="pb-2 pr-4 font-medium">作者</th>
              <th className="pb-2 pr-4 font-medium">含风半联</th>
              <th className="pb-2 pr-4 font-medium">状态</th>
              <th className="pb-2 font-medium">来源</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((p, i) => {
              const wt = p.humanOverride?.windType || p.analysis?.windType;
              return (
                <tr key={`${p.id}_${p.halfLine}_${i}`} className="border-b border-ink-50 hover:bg-ink-50/50">
                  <td className="py-2 pr-4 text-ink-400 font-mono text-xs">{p.id}</td>
                  <td className="py-2 pr-4 text-ink-700">{p.title}</td>
                  <td className="py-2 pr-4 text-ink-600">{p.author}</td>
                  <td className="py-2 pr-4 text-ink-700 max-w-xs truncate">{p.halfLine || '—'}</td>
                  <td className="py-2 pr-4">
                    {wt === 'nature' && <span className="tag-nature">自然意象</span>}
                    {wt === 'non-nature' && <span className="tag-non-nature">非自然</span>}
                    {!wt && <span className="tag-pending">待分析</span>}
                  </td>
                  <td className="py-2 text-ink-400 text-xs">
                    {p.source === 'half_line' ? '半联' : p.source === 'full_poem' ? '整首' : '上传'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length > 200 && (
          <p className="text-center text-ink-400 text-xs mt-3">
            显示前 200 条，共 {filtered.length} 条
          </p>
        )}
        {filtered.length === 0 && (
          <p className="text-center text-ink-400 py-8">
            {poems.length === 0 ? '暂无数据，请加载内置数据或上传文件' : '未找到匹配的结果'}
          </p>
        )}
      </div>
    </div>
  );
}
