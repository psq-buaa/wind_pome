import { create } from 'zustand';
import type { PoemEntry, ApiProvider, BatchProgress, AnalysisResult, ResearchReport } from './types';

const ANALYSIS_KEY = 'wind_poetry_analysis';
const KEYWORDS_KEY = 'wind_poetry_keywords';
const REPORTS_KEY = 'wind_poetry_reports';

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

// 关键词持久化
function loadPersistedKeywords(): string[] {
  try {
    const raw = localStorage.getItem(KEYWORDS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function persistKeywords(keywords: string[]) {
  try {
    localStorage.setItem(KEYWORDS_KEY, JSON.stringify(keywords));
  } catch { /* ignore */ }
}

// 研究报告持久化
function loadPersistedReports(): ResearchReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function persistReports(reports: ResearchReport[]) {
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  } catch { /* ignore */ }
}

// 清理旧版全量持久化数据
try { localStorage.removeItem('wind_poetry_poems'); } catch { /* ignore */ }

interface AppStore {
  // 数据
  poems: PoemEntry[];
  setPoems: (poems: PoemEntry[]) => void;
  addPoems: (poems: PoemEntry[]) => void;
  updatePoem: (id: string, halfLine: string | undefined, updates: Partial<PoemEntry>) => void;

  // 非自然意象关键词
  nonNatureKeywords: string[];
  setNonNatureKeywords: (keywords: string[]) => void;
  addKeyword: (keyword: string) => void;
  removeKeyword: (keyword: string) => void;

  // 多选
  selectedPoemKeys: string[];
  togglePoemSelection: (key: string) => void;
  setSelectedPoemKeys: (keys: string[]) => void;

  // 研究报告
  researchReports: ResearchReport[];
  addResearchReport: (report: ResearchReport) => void;
  deleteResearchReport: (id: string) => void;
  setResearchReports: (reports: ResearchReport[]) => void;

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

  // 选中诗歌（详情查看）
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

  // 非自然意象关键词
  nonNatureKeywords: loadPersistedKeywords(),
  setNonNatureKeywords: (keywords) => {
    persistKeywords(keywords);
    set({ nonNatureKeywords: keywords });
  },
  addKeyword: (keyword) => set((s) => {
    if (s.nonNatureKeywords.includes(keyword)) return s;
    const updated = [...s.nonNatureKeywords, keyword];
    persistKeywords(updated);
    return { nonNatureKeywords: updated };
  }),
  removeKeyword: (keyword) => set((s) => {
    const updated = s.nonNatureKeywords.filter(k => k !== keyword);
    persistKeywords(updated);
    return { nonNatureKeywords: updated };
  }),

  // 多选
  selectedPoemKeys: [],
  togglePoemSelection: (key) => set((s) => {
    const idx = s.selectedPoemKeys.indexOf(key);
    if (idx >= 0) {
      return { selectedPoemKeys: s.selectedPoemKeys.filter((_, i) => i !== idx) };
    }
    return { selectedPoemKeys: [...s.selectedPoemKeys, key] };
  }),
  setSelectedPoemKeys: (keys) => set({ selectedPoemKeys: keys }),

  // 研究报告
  researchReports: loadPersistedReports(),
  addResearchReport: (report) => set((s) => {
    const updated = [report, ...s.researchReports];
    persistReports(updated);
    return { researchReports: updated };
  }),
  deleteResearchReport: (id) => set((s) => {
    const updated = s.researchReports.filter(r => r.id !== id);
    persistReports(updated);
    return { researchReports: updated };
  }),
  setResearchReports: (reports) => {
    persistReports(reports);
    set({ researchReports: reports });
  },

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
