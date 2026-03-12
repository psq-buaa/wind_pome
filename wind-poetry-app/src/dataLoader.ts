import type { PoemEntry, HalfLine, FullPoem, AnalysisResult, ResearchReport } from './types';
import { loadPersistedAnalysis } from './store';

interface AnalysisInfo {
  analysis?: AnalysisResult;
  humanReviewed?: boolean;
  humanOverride?: Partial<AnalysisResult>;
}

/**
 * 加载内置诗歌数据并合并所有来源的分析结果
 * 优先级：内存已有 > localStorage 缓存 > analysis_cache.json 文件
 */
export async function loadBuiltinPoemData(existingPoems: PoemEntry[]): Promise<PoemEntry[]> {
  // 加载半联
  const halfRes = await fetch('/data/含风的半联.json');
  const halfData: HalfLine[] = await halfRes.json();

  // 加载整首诗
  const fullRes = await fetch('/data/full_poems.json');
  const fullData: FullPoem[] = await fullRes.json();

  // 来源1：analysis_cache.json 文件缓存
  const fileCacheMap = new Map<string, AnalysisInfo>();
  try {
    const cacheRes = await fetch('/data/analysis_cache.json');
    if (cacheRes.ok) {
      const cacheData: Array<{ key: string } & AnalysisInfo> = await cacheRes.json();
      cacheData.forEach(c => fileCacheMap.set(c.key, c));
    }
  } catch { /* 没有缓存文件，忽略 */ }

  // 来源2：localStorage 持久化的分析结果
  const persistedAnalysis = loadPersistedAnalysis();

  // 来源3：内存中已有数据（优先级最高）
  const existingMap = new Map<string, PoemEntry>();
  existingPoems.forEach(p => existingMap.set(`${p.id}__${p.halfLine || ''}`, p));

  // 构建整首诗索引
  const fullMap = new Map<string, FullPoem>();
  fullData.forEach(p => fullMap.set(p.id, p));

  // 合并：以半联为主，关联整首诗，按优先级合并分析结果
  const entries: PoemEntry[] = halfData.map(h => {
    const full = fullMap.get(h.id);
    const key = `${h.id}__${h.half_line || ''}`;
    const existing = existingMap.get(key);
    const persisted = persistedAnalysis.get(key);
    const fileCached = fileCacheMap.get(key);
    return {
      id: h.id,
      title: h.title,
      author: h.author,
      content: full?.content || '',
      halfLine: h.half_line,
      source: 'half_line' as const,
      humanReviewed: existing?.humanReviewed || persisted?.humanReviewed || fileCached?.humanReviewed || false,
      analysis: existing?.analysis || persisted?.analysis || fileCached?.analysis,
      humanOverride: existing?.humanOverride || persisted?.humanOverride || fileCached?.humanOverride,
    };
  });

  // 添加没有对应半联的整首诗
  const halfIds = new Set(halfData.map(h => h.id));
  fullData.forEach(p => {
    if (!halfIds.has(p.id)) {
      const key = `${p.id}__`;
      const existing = existingMap.get(key);
      const persisted = persistedAnalysis.get(key);
      const fileCached = fileCacheMap.get(key);
      entries.push({
        id: p.id,
        title: p.title,
        author: p.author,
        content: p.content,
        source: 'full_poem',
        humanReviewed: existing?.humanReviewed || persisted?.humanReviewed || fileCached?.humanReviewed || false,
        analysis: existing?.analysis || persisted?.analysis || fileCached?.analysis,
        humanOverride: existing?.humanOverride || persisted?.humanOverride || fileCached?.humanOverride,
      });
    }
  });

  // 保留用户上传的数据
  const builtinKeys = new Set(entries.map(e => `${e.id}__${e.halfLine || ''}`));
  existingPoems.forEach(p => {
    if (p.source === 'uploaded' && !builtinKeys.has(`${p.id}__${p.halfLine || ''}`)) {
      entries.push(p);
    }
  });

  return entries;
}

/** 加载内置关键词列表（合并 JSON 文件 + localStorage） */
export async function loadBuiltinKeywords(existingKeywords: string[]): Promise<string[]> {
  const keywordsSet = new Set(existingKeywords);
  try {
    const res = await fetch('/data/non_nature_keywords.json');
    if (res.ok) {
      const data: string[] = await res.json();
      data.forEach(k => keywordsSet.add(k));
    }
  } catch { /* ignore */ }
  return Array.from(keywordsSet);
}

/** 加载内置研究报告（合并 JSON 文件 + localStorage） */
export async function loadBuiltinReports(existingReports: ResearchReport[]): Promise<ResearchReport[]> {
  const existingIds = new Set(existingReports.map(r => r.id));
  const merged = [...existingReports];
  try {
    const res = await fetch('/data/research_reports.json');
    if (res.ok) {
      const data: ResearchReport[] = await res.json();
      data.forEach(r => {
        if (!existingIds.has(r.id)) merged.push(r);
      });
    }
  } catch { /* ignore */ }
  return merged;
}
