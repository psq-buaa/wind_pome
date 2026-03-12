import { useState } from 'react';
import { useStore } from '../store';
import { DEFAULT_PROVIDERS } from '../types';
import type { ApiProvider, ExportConfig } from '../types';
import { Key, Shield, Download, Trash2, TestTube, CheckCircle } from 'lucide-react';
import { callAI } from '../ai';
import { saveAs } from 'file-saver';

export default function Settings() {
  const poems = useStore((s) => s.poems);
  const apiProvider = useStore((s) => s.apiProvider);
  const setApiProvider = useStore((s) => s.setApiProvider);

  const [selectedProviderId, setSelectedProviderId] = useState(apiProvider?.id || 'deepseek');
  const [apiKey, setApiKey] = useState(apiProvider?.apiKey || '');
  const [customUrl, setCustomUrl] = useState(apiProvider?.baseUrl || '');
  const [customModel, setCustomModel] = useState(apiProvider?.model || '');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  function saveProvider() {
    const preset = DEFAULT_PROVIDERS.find(p => p.id === selectedProviderId);
    if (!preset) return;
    if (!apiKey.trim()) {
      alert('请输入 API 密钥');
      return;
    }
    const provider: ApiProvider = {
      id: preset.id,
      name: preset.name,
      baseUrl: preset.id === 'custom' ? customUrl : preset.baseUrl,
      model: preset.id === 'custom' ? customModel : preset.model,
      apiKey: apiKey.trim(),
    };
    setApiProvider(provider);
    setTestResult(null);
  }

  async function testConnection() {
    if (!apiProvider) {
      alert('请先保存 API 配置');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await callAI(apiProvider, '请用一句话回复：你好');
      setTestResult(`✓ 连接成功：${result.slice(0, 100)}`);
    } catch (err) {
      setTestResult(`✗ 连接失败：${err instanceof Error ? err.message : String(err)}`);
    }
    setTesting(false);
  }

  // 导出功能
  function handleExport(config: ExportConfig) {
    let data = poems;
    if (config.scope === 'nature') data = poems.filter(p => (p.humanOverride?.windType || p.analysis?.windType) === 'nature');
    else if (config.scope === 'non-nature') data = poems.filter(p => (p.humanOverride?.windType || p.analysis?.windType) === 'non-nature');
    else if (config.scope === 'reviewed') data = poems.filter(p => p.humanReviewed);

    if (config.format === 'json') {
      const exportData = data.map(p => ({
        id: p.id, title: p.title, author: p.author,
        halfLine: p.halfLine, content: p.content,
        ...(config.includeAnalysis ? {
          windType: p.humanOverride?.windType || p.analysis?.windType,
          sentiment: p.humanOverride?.sentiment || p.analysis?.sentiment,
          sentimentIntensity: p.humanOverride?.sentimentIntensity || p.analysis?.sentimentIntensity,
          windSubtype: p.humanOverride?.windSubtype || p.analysis?.windSubtype,
          keywords: p.analysis?.keywords,
          imageDescription: p.analysis?.imageDescription,
          humanReviewed: p.humanReviewed,
        } : {}),
      }));
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' });
      saveAs(blob, `wind_poems_${config.scope}_${Date.now()}.json`);
    } else {
      const headers = ['ID', '诗题', '作者', '半联', ...(config.includeAnalysis ? ['风类型', '情感', '强度', '风子类', '关键词'] : [])];
      const rows = data.map(p => [
        p.id, p.title, p.author, p.halfLine || '',
        ...(config.includeAnalysis ? [
          p.humanOverride?.windType || p.analysis?.windType || '',
          p.humanOverride?.sentiment || p.analysis?.sentiment || '',
          String(p.humanOverride?.sentimentIntensity || p.analysis?.sentimentIntensity || ''),
          p.humanOverride?.windSubtype || p.analysis?.windSubtype || '',
          (p.analysis?.keywords || []).join('|'),
        ] : []),
      ]);

      const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      saveAs(blob, `wind_poems_${config.scope}_${Date.now()}.csv`);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-ink-800">设置</h2>

      {/* API Config */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-wind-600" />
          <h3 className="font-semibold text-ink-700">AI API 配置</h3>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 text-amber-700 text-xs">
          <Shield className="w-4 h-4 shrink-0" />
          <span>API 密钥仅保存在浏览器内存中，刷新页面即清除，不会持久化存储。</span>
        </div>

        <div>
          <label className="text-sm text-ink-600 mb-1 block">API 提供方</label>
          <select
            className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-wind-400"
            value={selectedProviderId}
            onChange={e => setSelectedProviderId(e.target.value)}
          >
            {DEFAULT_PROVIDERS.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {selectedProviderId === 'custom' && (
          <>
            <div>
              <label className="text-sm text-ink-600 mb-1 block">API Base URL</label>
              <input
                className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-wind-400"
                placeholder="https://api.example.com/v1"
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-ink-600 mb-1 block">模型名称</label>
              <input
                className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-wind-400"
                placeholder="gpt-4o / deepseek-chat / ..."
                value={customModel}
                onChange={e => setCustomModel(e.target.value)}
              />
            </div>
          </>
        )}

        <div>
          <label className="text-sm text-ink-600 mb-1 block">API 密钥</label>
          <input
            type="password"
            className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-wind-400"
            placeholder="sk-..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button onClick={saveProvider} className="btn-primary">保存配置</button>
          <button onClick={testConnection} disabled={testing} className="btn-secondary flex items-center gap-1.5">
            <TestTube className="w-4 h-4" />
            {testing ? '测试中...' : '测试连接'}
          </button>
          {apiProvider && (
            <button onClick={() => { setApiProvider(null); setApiKey(''); setTestResult(null); }}
              className="btn-danger flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" /> 清除
            </button>
          )}
        </div>

        {apiProvider && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span>当前配置：{apiProvider.name} ({apiProvider.model})</span>
          </div>
        )}

        {testResult && (
          <div className={`p-3 rounded-lg text-sm ${testResult.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {testResult}
          </div>
        )}
      </div>

      {/* Export */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-wind-600" />
          <h3 className="font-semibold text-ink-700">数据导出</h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => handleExport({ format: 'json', scope: 'all', includeAnalysis: true })}
            className="btn-secondary text-left">
            <p className="font-medium">全部数据 (JSON)</p>
            <p className="text-xs text-ink-400 mt-0.5">{poems.length} 条，含分析结果</p>
          </button>
          <button onClick={() => handleExport({ format: 'csv', scope: 'all', includeAnalysis: true })}
            className="btn-secondary text-left">
            <p className="font-medium">全部数据 (CSV)</p>
            <p className="text-xs text-ink-400 mt-0.5">{poems.length} 条，含分析结果</p>
          </button>
          <button onClick={() => handleExport({ format: 'json', scope: 'nature', includeAnalysis: true })}
            className="btn-secondary text-left">
            <p className="font-medium">自然意象 (JSON)</p>
            <p className="text-xs text-ink-400 mt-0.5">仅自然意象的风</p>
          </button>
          <button onClick={() => handleExport({ format: 'csv', scope: 'nature', includeAnalysis: true })}
            className="btn-secondary text-left">
            <p className="font-medium">自然意象 (CSV)</p>
            <p className="text-xs text-ink-400 mt-0.5">仅自然意象的风</p>
          </button>
          <button onClick={() => handleExport({ format: 'json', scope: 'reviewed', includeAnalysis: true })}
            className="btn-secondary text-left">
            <p className="font-medium">已审核数据 (JSON)</p>
            <p className="text-xs text-ink-400 mt-0.5">仅人工审核的数据</p>
          </button>
          <button onClick={() => handleExport({ format: 'csv', scope: 'reviewed', includeAnalysis: true })}
            className="btn-secondary text-left">
            <p className="font-medium">已审核数据 (CSV)</p>
            <p className="text-xs text-ink-400 mt-0.5">仅人工审核的数据</p>
          </button>
        </div>
      </div>
    </div>
  );
}
