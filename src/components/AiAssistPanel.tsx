import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { AiMessage, OllamaHealth } from '../lib/types';
import { buildDiaryAssistantSystemPrompt } from '../lib/aiPrompts';
import { AI_DEFAULT_MODEL, AI_QUICK_PROMPTS } from '../lib/aiConfig';

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
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const recheckHealth = useCallback(() => {
    setHealthLoading(true);
    setError(null);
    window.aiAPI.checkHealth().then((result) => {
      setHealth(result);
      setHealthLoading(false);
    });
  }, []);

  useEffect(() => {
    recheckHealth();
  }, [recheckHealth]);

  useEffect(() => {
    if (requestIdRef.current) {
      void window.aiAPI.abort(requestIdRef.current);
      requestIdRef.current = null;
    }
    setStreaming(false);
    setMessages([]);
    setError(null);
    setInput('');
  }, [date]);

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

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming || !health?.ok || !health.hasModel) return;

      setError(null);
      setInput('');

      const userMessage: AiMessage = { role: 'user', content: trimmed };
      const assistantPlaceholder: AiMessage = { role: 'assistant', content: '' };
      const history = messagesRef.current;
      setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);

      const requestId = crypto.randomUUID();
      requestIdRef.current = requestId;
      setStreaming(true);

      const apiMessages: AiMessage[] = [
        { role: 'system', content: buildDiaryAssistantSystemPrompt(date, getContent()) },
        ...history,
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
    },
    [date, getContent, health, streaming],
  );

  const handleSend = useCallback(() => {
    void sendMessage(input);
  }, [input, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = health?.ok && health.hasModel && !streaming && input.trim().length > 0;
  const canQuickAsk = health?.ok && health.hasModel && !streaming;

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
          <button type="button" className="btn-secondary ai-health-retry" onClick={recheckHealth}>
            重新检测
          </button>
        </div>
      ) : !health.hasModel ? (
        <div className="ai-panel-health ai-panel-health--warn">
          <p>
            未检测到模型 <code>{AI_DEFAULT_MODEL}</code>。
          </p>
          <p>
            请先登录 Ollama，并运行：
            <br />
            <code>ollama pull {AI_DEFAULT_MODEL}</code>
          </p>
          <p className="ai-panel-health-note">
            该模型为 Ollama Cloud 模型，正文将经本机 Ollama 转发至云端推理。
          </p>
          <button type="button" className="btn-secondary ai-health-retry" onClick={recheckHealth}>
            重新检测
          </button>
        </div>
      ) : (
        <p className="ai-panel-model-hint">模型：{AI_DEFAULT_MODEL}（需已登录 Ollama）</p>
      )}

      {canQuickAsk && (
        <div className="ai-quick-prompts">
          {AI_QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              className="ai-quick-chip"
              onClick={() => void sendMessage(prompt.text)}
            >
              {prompt.label}
            </button>
          ))}
        </div>
      )}

      <div className="ai-messages scrollbar-pill">
        {messages.length === 0 && health?.ok && health.hasModel && (
          <p className="ai-messages-empty">基于今日日记提问，或点击上方快捷按钮</p>
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
              onClick={handleSend}
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
