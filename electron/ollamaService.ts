export const DEFAULT_MODEL = 'qwen3-vl:235b-cloud';
export const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
/** Nemotron 等推理模型默认会先流式输出 thinking，日记助手关闭以加快首字响应 */
export const DEFAULT_THINK = false;
/** 流式空闲超时：持续无新内容则中断（有输出时会不断重置，不会卡总时长） */
export const CHAT_STREAM_IDLE_TIMEOUT_MS = 120_000;
/** 流式总时长上限（安全兜底，正常对话很少触及） */
export const CHAT_STREAM_MAX_DURATION_MS = 600_000;
export const CHAT_STREAM_IPC_BATCH_MS = 45;

const DEFAULT_CHAT_OPTIONS = {
  num_predict: -1,
  num_ctx: 6144,
  temperature: 0.65,
  top_p: 0.9,
};

const DEFAULT_KEEP_ALIVE = '15m';

export class ChatStreamTimeoutError extends Error {
  readonly kind: 'idle' | 'max';

  constructor(kind: 'idle' | 'max') {
    super(kind);
    this.name = 'ChatStreamTimeoutError';
    this.kind = kind;
  }
}

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

function parseStreamChunkLine(
  line: string,
  onChunk: (text: string) => void,
): void {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const json = JSON.parse(trimmed) as {
      message?: { content?: string; thinking?: string };
      response?: string;
    };
    const chunk = json.message?.content ?? json.message?.thinking ?? json.response;
    if (chunk) onChunk(chunk);
  } catch {
    // ignore malformed stream lines
  }
}

export async function isModelRunning(
  model = DEFAULT_MODEL,
  baseUrl = DEFAULT_BASE_URL,
): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/ps`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return (data.models ?? []).some((m) => modelMatches(m.name, model));
  } catch {
    return false;
  }
}

/** 仅在模型未加载时预热；可被 abort 取消，避免与用户提问抢占 Ollama */
export async function warmupModel(
  model = DEFAULT_MODEL,
  baseUrl = DEFAULT_BASE_URL,
  signal?: AbortSignal,
): Promise<void> {
  if (await isModelRunning(model, baseUrl)) return;

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) return;
    signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
        keep_alive: DEFAULT_KEEP_ALIVE,
        options: { num_predict: 1 },
      }),
      signal: controller.signal,
    });
  } catch {
    // 预热失败或已取消，不阻断使用
  } finally {
    if (signal) signal.removeEventListener('abort', onAbort);
  }
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
  keepAlive?: string;
  options?: Record<string, number>;
  signal?: AbortSignal;
  idleTimeoutMs?: number;
  maxDurationMs?: number;
  onChunk: (text: string) => void;
}): Promise<void> {
  const {
    messages,
    model = DEFAULT_MODEL,
    baseUrl = DEFAULT_BASE_URL,
    think = DEFAULT_THINK,
    keepAlive = DEFAULT_KEEP_ALIVE,
    options: modelOptions = DEFAULT_CHAT_OPTIONS,
    signal,
    idleTimeoutMs = CHAT_STREAM_IDLE_TIMEOUT_MS,
    maxDurationMs = CHAT_STREAM_MAX_DURATION_MS,
    onChunk,
  } = options;

  const localController = new AbortController();
  let idleTimedOut = false;
  let maxTimedOut = false;
  let streamActive = false;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let maxTimer: ReturnType<typeof setTimeout> | null = null;

  const cleanupTimers = () => {
    if (idleTimer) clearTimeout(idleTimer);
    if (maxTimer) clearTimeout(maxTimer);
    idleTimer = null;
    maxTimer = null;
  };

  const bumpIdleTimer = () => {
    if (!streamActive) return;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleTimedOut = true;
      localController.abort();
    }, idleTimeoutMs);
  };

  const markStreamActive = () => {
    if (!streamActive) streamActive = true;
    bumpIdleTimer();
  };

  const onExternalAbort = () => localController.abort();
  if (signal) {
    if (signal.aborted) localController.abort();
    else signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  maxTimer = setTimeout(() => {
    maxTimedOut = true;
    localController.abort();
  }, maxDurationMs);

  const combinedSignal = localController.signal;

  try {
    const payload: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      keep_alive: keepAlive,
      options: modelOptions,
    };
    // gemma3 等模型传 think:false 可能导致长时间无响应，仅在显式开启时发送
    if (think) payload.think = true;

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: combinedSignal,
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
      if (done) {
        if (buffer.trim()) {
          parseStreamChunkLine(buffer, (chunk) => {
            markStreamActive();
            onChunk(chunk);
          });
        }
        break;
      }

      markStreamActive();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        parseStreamChunkLine(line, (chunk) => {
          markStreamActive();
          onChunk(chunk);
        });
      }
    }
  } catch (err) {
    if (signal?.aborted) return;
    if (idleTimedOut) throw new ChatStreamTimeoutError('idle');
    if (maxTimedOut) throw new ChatStreamTimeoutError('max');
    throw err;
  } finally {
    cleanupTimers();
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }
}
