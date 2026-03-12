// 半联数据
export interface HalfLine {
  id: string;
  title: string;
  author: string;
  half_line: string;
}

// 整首诗数据
export interface FullPoem {
  id: string;
  title: string;
  author: string;
  content: string;
}

// 风意象分类
export type WindType = 'nature' | 'non-nature' | 'pending';

// 情感类别
export type SentimentCategory =
  | '悲伤' | '欢乐' | '豪迈' | '凄凉' | '清新'
  | '思乡' | '孤寂' | '壮美' | '柔美' | '萧瑟'
  | '激昂' | '宁静' | '哀怨' | '其他';

// 情感强度 1-5
export type SentimentIntensity = 1 | 2 | 3 | 4 | 5;

// 风的自然意象子分类
export type WindNatureSubtype =
  | '春风' | '秋风' | '北风' | '南风' | '东风' | '西风'
  | '朔风' | '清风' | '寒风' | '暖风' | '微风' | '狂风'
  | '晓风' | '晚风' | '松风' | '熏风' | '金风' | '其他';

// 分析结果
export interface AnalysisResult {
  windType: WindType;
  windTypeReason: string;
  nonNatureCategory?: string;  // 非自然意象的分类
  sentiment?: SentimentCategory;
  sentimentIntensity?: SentimentIntensity;
  sentimentReason?: string;
  windSubtype?: WindNatureSubtype;
  keywords?: string[];
  imageDescription?: string;
}

// 诗歌条目（统一数据模型）
export interface PoemEntry {
  id: string;
  title: string;
  author: string;
  content: string;        // 完整诗歌内容
  halfLine?: string;      // 含风的半联
  source: 'half_line' | 'full_poem' | 'uploaded';
  analysis?: AnalysisResult;
  humanReviewed: boolean;
  humanOverride?: Partial<AnalysisResult>;
}

// API Provider 配置
export interface ApiProvider {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

// 预定义的 API Provider
export const DEFAULT_PROVIDERS: Omit<ApiProvider, 'apiKey'>[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  {
    id: 'apiyi',
    name: 'API易 (apiyi.com)',
    baseUrl: 'https://api.apiyi.com/v1',
    model: 'deepseek-chat',
  },
  {
    id: 'custom',
    name: '自定义 (兼容OpenAI格式)',
    baseUrl: '',
    model: '',
  },
];

// 批量分析进度
export interface BatchProgress {
  total: number;
  completed: number;
  current: string;
  status: 'idle' | 'running' | 'paused' | 'done' | 'error';
  errors: string[];
}

// 导出配置
export interface ExportConfig {
  format: 'json' | 'csv';
  scope: 'all' | 'nature' | 'non-nature' | 'reviewed';
  includeAnalysis: boolean;
}

// 研究报告
export interface ResearchReport {
  id: string;
  topic: string;
  content: string;        // AI 生成的报告内容（Markdown）
  generatedAt: string;    // ISO 时间戳
  dataSnapshot: {
    totalPoems: number;
    analyzedCount: number;
    natureCount: number;
    nonNatureCount: number;
  };
}

// 分类来源标识
export type ClassificationSource = 'human' | 'ai' | 'keyword' | 'none';

// 获取诗歌的有效风类型（优先级：人工 > AI > 关键词 > 待定）
export function getEffectiveWindType(
  poem: PoemEntry,
  keywords: string[],
): { type: WindType | 'pending'; source: ClassificationSource } {
  if (poem.humanOverride?.windType) {
    return { type: poem.humanOverride.windType, source: 'human' };
  }
  if (poem.analysis?.windType) {
    return { type: poem.analysis.windType, source: 'ai' };
  }
  const text = poem.halfLine || poem.content;
  if (text && keywords.some(kw => text.includes(kw))) {
    return { type: 'non-nature', source: 'keyword' };
  }
  return { type: 'pending', source: 'none' };
}

// 检查诗歌是否匹配指定关键词
export function poemMatchesKeyword(poem: PoemEntry, keyword: string): boolean {
  const text = poem.halfLine || poem.content;
  return !!text && text.includes(keyword);
}
