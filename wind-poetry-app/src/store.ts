import { create } from 'zustand';
import type { PoemEntry, ApiProvider, BatchProgress, AnalysisResult } from './types';

const ANALYSIS_KEY = 'wind_poetry_analysis';

// 分析结果缓存条目
interface AnalysisCacheEntry {
  analysis?: AnalysisResult;
  humanReviewed?: boolean;
  humanOverride?: Partial<AnalysisResult>;
}

// 从 localStorage 读取已持久化的分析结果
export function loadPersistedAnalysis(): Map<string, AnalysisCacheEntry> {
  try {
    const raw = localStorage.getItem(ANALYSIS_KEY);
    if (raw) {
      const cache: Array<{ key: string } & AnalysisCacheEntry> = JSON.parse(raw);
      const map = new Map<string, AnalysisCacheEntry>();
      cache.forEach(c => map.set(c.key, c));
      return map;
    }
  } catch { /* ignore */ }
  return new Map();
}

// 仅保存分析结果到 localStorage（体积小，不会超出5MB限额）
function persistAnalysis(poems: PoemEntry[]) {
  try {
    const analyzed = poems.filter(p => p.analysis || p.humanReviewed);
    if (analyzed.length === 0) {
      localStorage.removeItem(ANALYSIS_KEY);
      return;
    }
    const cache = analyzed.map(p => ({
      key: `${p.id}__${p.halfLine || ''}`,
      analysis: p.analysis,
      humanReviewed: p.humanReviewed,
      humanOverride: p.humanOverride,
    }));
    localStorage.setItem(ANALYSIS_KEY, JSON.stringify(cache));
  } catch { /* quota exceeded etc. */ }
}

// 清理旧版全量持久化数据（曾超出 localStorage 限额导致丢失）
try { localStorage.removeItem('wind_poetry_poems'); } catch { /* ignore */ }

interface AppStore {
  // 数据
  poems: PoemEntry[];
  setPoems: (poems: PoemEntry[]) => void;
  addPoems: (poems: PoemEntry[]) => void;
  updatePoem: (id: string, halfLine: string | undefined, updates: Partial<PoemEntry>) => void;

  // API 配置（仅内存，不持久化）
  apiProvider: ApiProvider | null;
  setApiProvider: (provider: ApiProvider | null) => void;

  // 批量进度
  batchProgress: BatchProgress;
  setBatchProgress: (progress: Partial<BatchProgress>) => void;

  // 筛选
  filterType: 'all' | 'nature' | 'non-nature' | 'pending';
  setFilterType: (t: 'all' | 'nature' | 'non-nature' | 'pending') => void;

  // 当前页面
  currentPage: string;
  setCurrentPage: (page: string) => void;

  // 选中诗歌
  selectedPoemKey: string | null;
  setSelectedPoemKey: (key: string | null) => void;
}

const poemKey = (p: { id: string; halfLine?: string }) => `${p.id}__${p.halfLine || ''}`;

export const useStore = create<AppStore>((set) => ({
  poems: [],
  setPoems: (poems) => {
    persistAnalysis(poems);
    set({ poems });
  },
  addPoems: (newPoems) => set((s) => {
    const existingKeys = new Set(s.poems.map(p => poemKey(p)));
    const unique = newPoems.filter(p => !existingKeys.has(poemKey(p)));
    const merged = [...s.poems, ...unique];
    persistAnalysis(merged);
    return { poems: merged };
  }),
  updatePoem: (id, halfLine, updates) => set((s) => {
    const updated = s.poems.map(p =>
      p.id === id && p.halfLine === halfLine ? { ...p, ...updates } : p
    );
    persistAnalysis(updated);
    return { poems: updated };
  }),

  apiProvider: null,
  setApiProvider: (provider) => set({ apiProvider: provider }),

  batchProgress: {
    total: 0, completed: 0, current: '', status: 'idle', errors: [],
  },
  setBatchProgress: (progress) => set((s) => ({
    batchProgress: { ...s.batchProgress, ...progress },
  })),

  filterType: 'all',
  setFilterType: (filterType) => set({ filterType }),

  currentPage: 'dashboard',
  setCurrentPage: (currentPage) => set({ currentPage }),

  selectedPoemKey: null,
  setSelectedPoemKey: (selectedPoemKey) => set({ selectedPoemKey }),
}));
