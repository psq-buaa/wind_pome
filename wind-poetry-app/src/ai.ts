import type { ApiProvider, AnalysisResult } from './types';

function buildClassifyPrompt(halfLine: string, fullContent: string): string {
  return `你是一位精通古典诗词的学者。请分析以下唐诗中"风"字的含义。

诗句（含风的半联）：${halfLine}
完整诗歌内容：${fullContent || '（无完整内容）'}

请判断此处"风"是否表示自然意象（即自然界中的风、气流、风吹等），还是非自然意象（如"风俗""风流""风雅""风骨""风化""风范""国风""风尘"中的引申义）。

请以JSON格式回复，不要包含markdown代码块标记：
{
  "windType": "nature" 或 "non-nature",
  "windTypeReason": "判断理由，简洁说明",
  "nonNatureCategory": "如果是非自然意象，说明属于什么类别",
  "windSubtype": "如果是自然意象，子分类：春风/秋风/北风/南风/东风/西风/朔风/清风/寒风/暖风/微风/狂风/晓风/晚风/松风/熏风/金风/其他",
  "sentiment": "情感类别：悲伤/欢乐/豪迈/凄凉/清新/思乡/孤寂/壮美/柔美/萧瑟/激昂/宁静/哀怨/其他",
  "sentimentIntensity": 1到5的数字表示情感强度,
  "sentimentReason": "情感分析理由",
  "keywords": ["关键意象词1", "关键意象词2"],
  "imageDescription": "用一句话描述这个风意象所营造的画面或氛围"
}`;
}

export async function callAI(provider: ApiProvider, prompt: string): Promise<string> {
  const url = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: '你是一位精通中国古典诗词的学者，擅长分析诗词中的自然意象和情感。请严格按要求的JSON格式回复。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 800,
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API 请求失败 (${response.status}): ${errText}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function parseAIResponse(text: string): AnalysisResult {
  let jsonStr = text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) jsonStr = jsonMatch[0];
  const parsed = JSON.parse(jsonStr);
  return {
    windType: parsed.windType === 'nature' ? 'nature' : 'non-nature',
    windTypeReason: parsed.windTypeReason || '',
    nonNatureCategory: parsed.nonNatureCategory || undefined,
    sentiment: parsed.sentiment || '其他',
    sentimentIntensity: Math.min(5, Math.max(1, Number(parsed.sentimentIntensity) || 3)) as any,
    sentimentReason: parsed.sentimentReason || '',
    windSubtype: parsed.windSubtype || '其他',
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    imageDescription: parsed.imageDescription || '',
  };
}

export async function analyzeSinglePoem(
  provider: ApiProvider, halfLine: string, fullContent: string,
): Promise<AnalysisResult> {
  const prompt = buildClassifyPrompt(halfLine, fullContent);
  const response = await callAI(provider, prompt);
  return parseAIResponse(response);
}

export const RESEARCH_TOPICS = [
  { id: 'overview', name: '风意象总览', desc: '全唐诗中"风"意象的整体特征、分布和规律' },
  { id: 'history', name: '历史变迁', desc: '风意象在唐代不同时期的演变脉络' },
  { id: 'emotion', name: '情感分析', desc: '风意象承载的情感特征与情感分布' },
  { id: 'subtype', name: '风类型对比', desc: '春风、秋风、北风等不同类型的特征对比' },
  { id: 'poet', name: '诗人脉络', desc: '不同诗人对风意象的运用特点与传承' },
  { id: 'nature_vs_non', name: '自然与非自然', desc: '风的自然意象与非自然意义的分布与关联' },
  { id: 'custom', name: '自定义主题', desc: '输入自定义研究主题' },
] as const;

export async function generateResearchReport(
  provider: ApiProvider,
  topicId: string,
  customTopic: string,
  stats: { total: number; analyzed: number; nature: number; nonNature: number; sentimentDist: Record<string, number>; subtypeDist: Record<string, number>; topAuthors: { name: string; count: number }[] },
  samplePoems: { title: string; author: string; halfLine: string; sentiment?: string; windSubtype?: string }[],
): Promise<string> {
  const topic = RESEARCH_TOPICS.find(t => t.id === topicId);
  const topicName = topicId === 'custom' ? customTopic : topic?.name || topicId;
  const topicDesc = topicId === 'custom' ? customTopic : topic?.desc || '';

  const dataSummary = `数据概况：
- 总诗句数: ${stats.total}，已分析: ${stats.analyzed}
- 自然意象: ${stats.nature}，非自然意象: ${stats.nonNature}
- 情感分布: ${Object.entries(stats.sentimentDist).map(([k, v]) => `${k}(${v})`).join('、')}
- 风类型: ${Object.entries(stats.subtypeDist).map(([k, v]) => `${k}(${v})`).join('、')}
- 高频诗人: ${stats.topAuthors.map(a => `${a.name}(${a.count}首)`).join('、')}`;

  const sampleText = samplePoems.slice(0, 30).map((p, i) =>
    `${i + 1}. 《${p.title}》${p.author} - "${p.halfLine}" [${p.windSubtype || ''}/${p.sentiment || ''}]`
  ).join('\n');

  const prompt = `你是一位专业的古典文学研究者，正在协助撰写关于全唐诗中"风"意象的学术论文。

研究主题：${topicName}
主题说明：${topicDesc}

${dataSummary}

代表性诗句样本：
${sampleText}

请基于以上数据撰写详细的研究分析报告：
1. 学术论文风格，条理清晰
2. 包含数据分析、诗句引用、深入阐释
3. 提出有学术价值的观点和结论
4. Markdown 格式，1500-3000 字

请直接输出报告内容：`;

  return callAI(provider, prompt);
}
