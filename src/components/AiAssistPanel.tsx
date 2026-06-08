import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { AiMessage, OllamaHealth } from '../lib/types';
import { buildDiaryAssistantSystemPrompt } from '../lib/aiPrompts';

const DEFAULT_MODEL = 'nemotron-3-super:cloud';

interface AiAssistPanelProps {
  date: string;
  getContent: () => string;
  onClose: () => void;
}

export const AiAssistPanel = memo(function AiAssistPanel({
  date,
  getContent,
  onClose,
}: AiAssistPanelProps) {
  const [health, setHealth] = useState<OllamaHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    setHealthLoading(true);
    window.aiAPI.checkHealth().then((result) => {
      if (cancelled) return;
      setHealth(result);
      setHealthLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onChunk = ({ requestId, chunk }: { requestId: string; chunk: string }) => {
      if (requestId !== requestIdRef.current) return;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
        }
        return [...prev, { role: 'assistant', content: chunk }];
      });
    };

    const onDone = ({ requestId }: { requestId: string }) => {
      if (requestId !== requestIdRef.current) return;
      requestIdRef.current = null;
      setStreaming(false);
    };

    const onStreamError = ({ requestId, error: err }: { requestId: string; error: string }) => {
      if (requestId !== requestIdRef.current) return;
      requestIdRef.current = null;
      setStreaming(false);
      setError(err);
    };

    const unsubChunk = window.aiAPI.onStreamChunk(onChunk);
    const unsubDone = window.aiAPI.onStreamDone(onDone);
    const unsubError = window.aiAPI.onStreamError(onStreamError);

    return () => {
      unsubChunk();
      unsubDone();
      unsubError();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !streaming) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, streaming]);

  useEffect(() => {
    return () => {
      if (requestIdRef.current) {
        void window.aiAPI.abort(requestIdRef.current);
      }
    };
  }, []);

  const handleStop = useCallback(() => {
    if (requestIdRef.current) {
      void window.aiAPI.abort(requestIdRef.current);
    }
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming || !health?.ok || !health.hasModel) return;

    setError(null);
    setInput('');

    const userMessage: AiMessage = { role: 'user', content: text };
    const assistantPlaceholder: AiMessage = { role: 'assistant', content: '' };
    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);

    const requestId = crypto.randomUUID();
    requestIdRef.current = requestId;
    setStreaming(true);

    const apiMessages: AiMessage[] = [
      { role: 'system', content: buildDiaryAssistantSystemPrompt(date, getContent()) },
      ...messages,
      userMessage,
    ];

    try {
      await window.aiAPI.chatStream(requestId, apiMessages);
    } catch (err) {
      if (requestIdRef.current === requestId) {
        requestIdRef.current = null;
        setStreaming(false);
        setError(err instanceof Error ? err.message : '发送失败');
      }
    }
  }, [date, getContent, health, input, messages, streaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const canSend = health?.ok && health.hasModel && !streaming && input.trim().length > 0;

  return (
    <aside className="ai-panel" role="dialog" aria-label="AI 助手">
      <div className="ai-panel-header">
        <h3 className="ai-panel-title">AI 助手</h3>
        <button type="button" className="ai-panel-close" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </div>

      {healthLoading ? (
        <div className="ai-panel-health ai-panel-health--loading">正在检测 Ollama…</div>
      ) : !health?.ok ? (
        <div className="ai-panel-health ai-panel-health--error">
          <p>无法连接 Ollama 服务。</p>
          <p>请确认已安装并启动 Ollama（默认端口 11434）。</p>
          {health?.error && <p className="ai-panel-health-detail">{health.error}</p>}
        </div>
      ) : !health.hasModel ? (
        <div className="ai-panel-health ai-panel-health--warn">
          <p>未检测到模型 <code>{DEFAULT_MODEL}</code>。</p>
          <p>
            请先登录 Ollama，并运行：
            <br />
            <code>ollama pull {DEFAULT_MODEL}</code>
          </p>
          <p className="ai-panel-health-note">
            该模型为 Ollama Cloud 模型，正文将经本机 Ollama 转发至云端推理。
          </p>
        </div>
      ) : (
        <p className="ai-panel-model-hint">
          模型：{DEFAULT_MODEL}（需已登录 Ollama）
        </p>
      )}

      <div className="ai-messages scrollbar-pill">
        {messages.length === 0 && health?.ok && health.hasModel && (
          <p className="ai-messages-empty">基于今日日记提问，例如「帮我总结今天写了什么」</p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`ai-bubble ai-bubble--${msg.role}${msg.role === 'assistant' && !msg.content && streaming ? ' ai-bubble--typing' : ''}`}
          >
            {msg.content || (msg.role === 'assistant' && streaming ? '…' : '')}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="ai-panel-error" role="alert">
          {error}
        </div>
      )}

      <div className="ai-input-area">
        <textarea
          ref={inputRef}
          className="ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入问题… (Enter 发送，Shift+Enter 换行)"
          rows={2}
          disabled={!health?.ok || !health?.hasModel || streaming}
        />
        <div className="ai-input-actions">
          {streaming ? (
            <button type="button" className="btn-secondary ai-btn-stop" onClick={handleStop}>
              停止
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary ai-btn-send"
              onClick={() => void handleSend()}
              disabled={!canSend}
            >
              发送
            </button>
          )}
        </div>
      </div>
    </aside>
  );
});
