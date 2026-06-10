import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { AiMessage, OllamaHealth } from '../lib/types';
import { buildDiaryAssistantSystemPrompt } from '../lib/aiPrompts';
import { AI_DEFAULT_MODEL, AI_QUICK_PROMPTS } from '../lib/aiConfig';
import { clearAiChat, loadAiChat, saveAiChat } from '../lib/aiChatStore';
import { formatDisplayDate } from '../lib/dateUtils';
import { renderSimpleMarkdown } from '../lib/simpleMarkdown';
import { countDiaryChars } from '../lib/textUtils';

interface AiChatPageProps {
  active: boolean;
  date: string;
  onSelectDate: (date: string) => void;
  onNotify?: (message: string) => void;
}

export const AiChatPage = memo(function AiChatPage({
  active,
  date,
  onSelectDate,
  onNotify,
}: AiChatPageProps) {
  const [health, setHealth] = useState<OllamaHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diaryContent, setDiaryContent] = useState('');
  const [diaryLoading, setDiaryLoading] = useState(true);
  const requestIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  const diaryContentRef = useRef(diaryContent);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  messagesRef.current = messages;
  diaryContentRef.current = diaryContent;

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
    if (!active) return;
    let cancelled = false;
    setDiaryLoading(true);
    window.diaryAPI.getEntry(date).then((entry) => {
      if (cancelled) return;
      setDiaryContent(entry?.content ?? '');
      setDiaryLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [date, active]);

  useEffect(() => {
    if (requestIdRef.current) {
      void window.aiAPI.abort(requestIdRef.current);
      requestIdRef.current = null;
    }
    setStreaming(false);
    setError(null);
    setInput('');
    setMessages(loadAiChat(date));
  }, [date]);

  useEffect(() => {
    if (!active || streaming) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      saveAiChat(date, messages);
      persistTimerRef.current = null;
    }, 500);
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [active, date, messages, streaming]);

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
    messagesEndRef.current?.scrollIntoView({ behavior: streaming ? 'auto' : 'smooth' });
  }, [messages, streaming]);

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
        {
          role: 'system',
          content: buildDiaryAssistantSystemPrompt(date, diaryContentRef.current),
        },
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
    [date, health, streaming],
  );

  const handleSend = useCallback(() => {
    void sendMessage(input);
  }, [input, sendMessage]);

  const handleClearChat = useCallback(() => {
    if (streaming) return;
    if (messages.length === 0) return;
    if (!window.confirm(`确定清空 ${formatDisplayDate(date)} 的对话记录吗？`)) return;
    clearAiChat(date);
    setMessages([]);
    setError(null);
    onNotify?.('已清空该日对话');
  }, [date, messages.length, onNotify, streaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = health?.ok && health.hasModel && !streaming && input.trim().length > 0;
  const canQuickAsk = health?.ok && health.hasModel && !streaming;
  const charCount = countDiaryChars(diaryContent);
  const hasDiary = charCount > 0;

  return (
    <div className="ai-chat-page">
      <div className="ai-chat-card">
        <div className="ai-chat-toolbar">
          <div className="ai-chat-context">
            <p className="ai-chat-context-label">关联日记</p>
            <p className="ai-chat-context-date">{formatDisplayDate(date)}</p>
            <p className="ai-chat-context-meta">
              {diaryLoading ? '加载日记中…' : hasDiary ? `${charCount} 字` : '暂无正文'}
            </p>
          </div>
          <div className="ai-chat-toolbar-actions">
            <button
              type="button"
              className="btn-secondary ai-chat-jump"
              onClick={() => onSelectDate(date)}
              title="在编辑器中打开该日日记"
            >
              打开日记
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleClearChat}
              disabled={streaming || messages.length === 0}
            >
              清空对话
            </button>
          </div>
        </div>

        {healthLoading ? (
          <div className="ai-chat-health ai-chat-health--loading">正在检测 Ollama…</div>
        ) : !health?.ok ? (
          <div className="ai-chat-health ai-chat-health--error">
            <p>无法连接 Ollama 服务，请确认已安装并启动（默认端口 11434）。</p>
            {health?.error && <p className="ai-panel-health-detail">{health.error}</p>}
            <button type="button" className="btn-secondary ai-health-retry" onClick={recheckHealth}>
              重新检测
            </button>
          </div>
        ) : !health.hasModel ? (
          <div className="ai-chat-health ai-chat-health--warn">
            <p>
              未检测到模型 <code>{AI_DEFAULT_MODEL}</code>，请运行{' '}
              <code>ollama pull {AI_DEFAULT_MODEL}</code>
            </p>
            <button type="button" className="btn-secondary ai-health-retry" onClick={recheckHealth}>
              重新检测
            </button>
          </div>
        ) : (
          <p className="ai-chat-model-hint">模型：{AI_DEFAULT_MODEL}</p>
        )}

        {canQuickAsk && (
          <div className="ai-quick-prompts ai-quick-prompts--page">
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

        <div className="ai-chat-messages scrollbar-pill">
          {messages.length === 0 && health?.ok && health.hasModel && (
            <div className="ai-chat-empty">
              <p className="ai-chat-empty-title">开始与 AI 对话</p>
              <p className="ai-chat-empty-desc">
                对话将基于 {formatDisplayDate(date)} 的日记内容，切换日历日期可查看各日历史记录。
              </p>
            </div>
          )}
          {messages.map((msg, i) => {
            const isLast = i === messages.length - 1;
            const isStreamingThis =
              streaming && isLast && msg.role === 'assistant';
            const showMarkdown =
              msg.role === 'assistant' && !!msg.content && !isStreamingThis;

            return (
              <div
                key={i}
                className={`ai-bubble ai-bubble--${msg.role}${isStreamingThis && !msg.content ? ' ai-bubble--typing' : ''}`}
              >
                {!msg.content && isStreamingThis ? (
                  <span className="ai-bubble--waiting">正在生成回复…</span>
                ) : showMarkdown ? (
                  <div className="ai-bubble-md">{renderSimpleMarkdown(msg.content)}</div>
                ) : (
                  msg.content
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className="ai-panel-error" role="alert">
            {error}
          </div>
        )}

        <div className="ai-chat-input-area">
          <div className="ai-input-composer">
            <textarea
              className="ai-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入问题… (Enter 发送，Shift+Enter 换行)"
              rows={3}
              disabled={!health?.ok || !health?.hasModel || streaming}
            />
            <div className="ai-input-composer-actions">
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
        </div>
      </div>
    </div>
  );
});
