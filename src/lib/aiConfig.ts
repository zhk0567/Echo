export const AI_DEFAULT_MODEL = 'qwen3-vl:235b-cloud';

/** 送入模型的日记正文上限（字），过长会显著拖慢本地小模型） */
export const AI_MAX_DIARY_CONTEXT_CHARS = 3500;

/** 多轮对话时仅保留最近 N 条消息（user+assistant 各算一条） */
export const AI_MAX_HISTORY_MESSAGES = 6;

/** 生成 token 上限；云端模型要求为正数，8192 足够长回复 */
export const AI_NUM_PREDICT = 8192;

/** 上下文窗口；与日记截断配合，略大于正文+对话即可 */
export const AI_NUM_CTX = 6144;

export const AI_KEEP_ALIVE = '15m';

export const AI_CHAT_OPTIONS = {
  num_predict: AI_NUM_PREDICT,
  num_ctx: AI_NUM_CTX,
  temperature: 0.65,
  top_p: 0.9,
};

export const AI_QUICK_PROMPTS = [
  { label: '总结今日', text: '帮我总结今天日记的主要内容' },
  { label: '情绪感受', text: '从文字里读出我今天的情绪和感受' },
  { label: '写作建议', text: '给我一些温和的写作或反思建议' },
] as const;
