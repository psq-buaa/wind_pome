import { create } from 'zustand';
import type { PoemEntry, ApiProvider, BatchProgress } from './types';

const STORAGE_KEY = 'wind_poetry_poems';

// 从 localStorage 读取已持久化的诗歌数据（含分析结果）
function loadPersistedPoems(): PoemEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

// 保存诗歌数据到 localStorage
function persistPoems(poems: PoemEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(poems));
  } catch { /* quota exceeded etc. */ }
}

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
  poems: loadPersistedPoems(),
  setPoems: (poems) => {
    persistPoems(poems);
    set({ poems });
  },
  addPoems: (newPoems) => set((s) => {
    const existingKeys = new Set(s.poems.map(p => poemKey(p)));
    const unique = newPoems.filter(p => !existingKeys.has(poemKey(p)));
    const merged = [...s.poems, ...unique];
    persistPoems(merged);
    return { poems: merged };
  }),
  updatePoem: (id, halfLine, updates) => set((s) => {
    const updated = s.poems.map(p =>
      p.id === id && p.halfLine === halfLine ? { ...p, ...updates } : p
    );
    persistPoems(updated);
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
