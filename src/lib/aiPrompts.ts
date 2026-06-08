import type { AnalyticsData } from './types';
import { formatCompactDisplayDate } from './dateUtils';

const MAX_DIARY_CONTEXT_CHARS = 8000;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n…（正文已截断，仅发送前 ${max} 字）`;
}

export function buildDiaryAssistantSystemPrompt(date: string, content: string): string {
  const trimmed = content.trim();
  const body = trimmed ? truncate(trimmed, MAX_DIARY_CONTEXT_CHARS) : '（今日尚无正文）';

  return `你是 Echo 日记应用中的私人写作助手。用户正在查看 ${date} 的日记。

规则：
- 使用简体中文回答
- 基于下方日记内容作答，不要编造未出现的事实
- 尊重隐私，语气温暖、克制
- 可帮用户总结、反思、拓展思路，但不要替用户写日记正文除非明确要求

【${date} 日记正文】
${body}`;
}

export function buildAnalyticsInsightSystemPrompt(data: AnalyticsData): string {
  const { summary, monthlyTrend, weekdayDistribution, topEntries, bottomEntries } = data;

  const topMonths = [...monthlyTrend]
    .sort((a, b) => b.chars - a.chars)
    .slice(0, 3)
    .map((m) => `${m.month}：${m.entries} 篇 / ${m.chars} 字`)
    .join('；');

  const weekdays = weekdayDistribution
    .map((w) => `周${w.label}：${w.entries} 篇 / ${w.chars} 字`)
    .join('；');

  const topList = topEntries
    .map((e) => `${formatCompactDisplayDate(e.date)}（${e.chars} 字）`)
    .join('、');
  const bottomList = bottomEntries
    .map((e) => `${formatCompactDisplayDate(e.date)}（${e.chars} 字）`)
    .join('、');

  return `你是 Echo 日记应用的数据分析助手。根据以下写作统计数据，生成洞察报告。

规则：
- 使用简体中文与 Markdown 标题
- 只根据给定数据推断，不要编造具体日记内容
- 结构必须包含以下四节：
  ## 写作趋势
  ## 写作习惯
  ## 情绪与主题（基于数据模式的合理推测，注明是推测）
  ## 一句建议

【数据摘要】
- 累计日记：${summary.totalEntries} 篇，${summary.totalChars} 字
- 连续写作：${summary.streak} 天；活跃天数：${summary.activeDays}
- 篇均字数：${summary.avgCharsPerEntry}
- 时间范围：${summary.firstEntryDate ?? '—'} 至 ${summary.lastEntryDate ?? '—'}
- 字数最高月份：${topMonths || '无'}
- 星期分布：${weekdays || '无'}
- 最长日记：${topList || '无'}
- 最短日记：${bottomList || '无'}`;
}

export const ANALYTICS_INSIGHT_USER_PROMPT =
  '请根据上述统计数据，生成一份简洁、有温度的写作洞察报告。';
