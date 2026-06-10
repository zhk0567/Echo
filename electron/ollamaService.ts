export const DEFAULT_MODEL = 'nemotron-3-super:cloud';
export const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
/** Nemotron 等推理模型默认会先流式输出 thinking，日记助手关闭以加快首字响应 */
export const DEFAULT_THINK = false;

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaHealth {
  ok: boolean;
  hasModel: boolean;
  models: string[];
  error?: string;
}

function modelMatches(available: string, target: string): boolean {
  return (
    available === target ||
    available.startsWith(`${target}:`) ||
    available.endsWith(`:${target}`) ||
    available.includes(target)
  );
}

export async function checkOllamaHealth(
  model = DEFAULT_MODEL,
  baseUrl = DEFAULT_BASE_URL,
): Promise<OllamaHealth> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { ok: false, hasModel: false, models: [], error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const models = (data.models ?? []).map((m) => m.name);
    const hasModel = models.some((name) => modelMatches(name, model));
    return { ok: true, hasModel, models };
  } catch (err) {
    const message = err instanceof Error ? err.message : '无法连接 Ollama';
    return { ok: false, hasModel: false, models: [], error: message };
  }
}

export async function chatStream(options: {
  messages: AiMessage[];
  model?: string;
  baseUrl?: string;
  think?: boolean;
  signal?: AbortSignal;
  onChunk: (text: string) => void;
}): Promise<void> {
  const {
    messages,
    model = DEFAULT_MODEL,
    baseUrl = DEFAULT_BASE_URL,
    think = DEFAULT_THINK,
    signal,
    onChunk,
  } = options;

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true, think }),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `Ollama 请求失败 (${res.status})`);
  }

  if (!res.body) {
    throw new Error('Ollama 未返回数据流');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const json = JSON.parse(trimmed) as {
          message?: { content?: string; thinking?: string };
        };
        const chunk = json.message?.content || json.message?.thinking;
        if (chunk) onChunk(chunk);
      } catch {
        // ignore malformed stream lines
      }
    }
  }
}
