import type { ApiProvider, AnalysisResult } from './types';

// 构建风意象分类 prompt
function buildClassifyPrompt(halfLine: string, fullContent: string): string {
  return `你是一位精通古典诗词的学者。请分析以下唐诗中"风"字的含义。

诗句（含风的半联）：${halfLine}
完整诗歌内容：${fullContent || '（无完整内容）'}

请判断此处"风"是否表示自然意象（即自然界中的风、气流、风吹等），还是非自然意象（如"风俗""风流""风雅""风骨""风化""风范""国风""风尘"中的引申义）。

请以JSON格式回复，不要包含markdown代码块标记：
{
  "windType": "nature" 或 "non-nature",
  "windTypeReason": "判断理由，简洁说明",
  "nonNatureCategory": "如果是非自然意象，说明属于什么类别，如风俗、风流、风雅、风骨等",
  "windSubtype": "如果是自然意象，子分类：春风/秋风/北风/南风/东风/西风/朔风/清风/寒风/暖风/微风/狂风/晓风/晚风/松风/熏风/金风/其他",
  "sentiment": "情感类别：悲伤/欢乐/豪迈/凄凉/清新/思乡/孤寂/壮美/柔美/萧瑟/激昂/宁静/哀怨/其他",
  "sentimentIntensity": 1到5的数字表示情感强度,
  "sentimentReason": "情感分析理由",
  "keywords": ["关键意象词1", "关键意象词2"],
  "imageDescription": "用一句话描述这个风意象所营造的画面或氛围"
}`;
}

// 调用 AI API (兼容 OpenAI 格式)
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
        {
          role: 'system',
          content: '你是一位精通中国古典诗词的学者，擅长分析诗词中的自然意象和情感。请严格按要求的JSON格式回复。'
        },
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

// 解析 AI 返回的 JSON
function parseAIResponse(text: string): AnalysisResult {
  // 尝试提取 JSON
  let jsonStr = text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

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

// 分析单条诗歌
export async function analyzeSinglePoem(
  provider: ApiProvider,
  halfLine: string,
  fullContent: string,
): Promise<AnalysisResult> {
  const prompt = buildClassifyPrompt(halfLine, fullContent);
  const response = await callAI(provider, prompt);
  return parseAIResponse(response);
}

// 批量情感深度分析 prompt
export function buildDeepAnalysisPrompt(poems: { halfLine: string; content: string; author: string; title: string }[]): string {
  const poemList = poems.map((p, i) =>
    `${i + 1}. 《${p.title}》${p.author} - 半联："${p.halfLine}"`
  ).join('\n');

  return `请对以下${poems.length}首唐诗中"风"的自然意象进行情感脉络分析：

${poemList}

请以JSON格式回复，不要包含markdown代码块标记：
{
  "overallTheme": "整体情感主题概述",
  "emotionalProgression": "情感变化脉络描述",
  "connections": [
    {"from": 1, "to": 3, "relation": "情感联系描述"}
  ],
  "clusters": [
    {"name": "簇名", "poemIndices": [1,2], "description": "描述"}
  ]
}`;
}
