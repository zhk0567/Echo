import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { AiMessage, AnalyticsData, OllamaHealth } from '../lib/types';
import {
  ANALYTICS_INSIGHT_USER_PROMPT,
  buildAnalyticsInsightSystemPrompt,
} from '../lib/aiPrompts';

const DEFAULT_MODEL = 'nemotron-3-super:cloud';

interface AnalyticsInsightProps {
  data: AnalyticsData;
  refreshKey: number;
  onNotify?: (message: string) => void;
}

export const AnalyticsInsight = memo(function AnalyticsInsight({
  data,
  refreshKey,
  onNotify,
}: AnalyticsInsightProps) {
  const [insight, setInsight] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [health, setHealth] = useState<OllamaHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    setInsight('');
    setError(null);
  }, [refreshKey]);

  useEffect(() => {
    const onChunk = ({ requestId, chunk }: { requestId: string; chunk: string }) => {
      if (requestId !== requestIdRef.current) return;
      setInsight((prev) => prev + chunk);
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
      onNotify?.(`AI 洞察生成失败：${err}`);
    };

    const unsubChunk = window.aiAPI.onStreamChunk(onChunk);
    const unsubDone = window.aiAPI.onStreamDone(onDone);
    const unsubError = window.aiAPI.onStreamError(onStreamError);

    return () => {
      unsubChunk();
      unsubDone();
      unsubError();
    };
  }, [onNotify]);

  useEffect(() => {
    return () => {
      if (requestIdRef.current) {
        void window.aiAPI.abort(requestIdRef.current);
      }
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    if (streaming) return;

    setError(null);
    setInsight('');

    const healthResult = await window.aiAPI.checkHealth();
    setHealth(healthResult);

    if (!healthResult.ok) {
      const msg = '无法连接 Ollama，请确认服务已启动';
      setError(msg);
      onNotify?.(msg);
      return;
    }
    if (!healthResult.hasModel) {
      const msg = `请先运行 ollama pull ${DEFAULT_MODEL}`;
      setError(msg);
      onNotify?.(msg);
      return;
    }

    const requestId = crypto.randomUUID();
    requestIdRef.current = requestId;
    setStreaming(true);

    const messages: AiMessage[] = [
      { role: 'system', content: buildAnalyticsInsightSystemPrompt(dataRef.current) },
      { role: 'user', content: ANALYTICS_INSIGHT_USER_PROMPT },
    ];

    try {
      await window.aiAPI.chatStream(requestId, messages);
    } catch (err) {
      if (requestIdRef.current === requestId) {
        requestIdRef.current = null;
        setStreaming(false);
        const msg = err instanceof Error ? err.message : '生成失败';
        setError(msg);
        onNotify?.(msg);
      }
    }
  }, [onNotify, streaming]);

  const handleStop = useCallback(() => {
    if (requestIdRef.current) {
      void window.aiAPI.abort(requestIdRef.current);
    }
  }, []);

  if (data.summary.totalEntries === 0) {
    return null;
  }

  return (
    <section className="analytics-section ai-insight-section">
      <div className="ai-insight-header">
        <h3 className="analytics-section-title">AI 洞察</h3>
        <div className="ai-insight-actions">
          {streaming ? (
            <button type="button" className="btn-secondary" onClick={handleStop}>
              停止
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => void handleGenerate()}>
              生成 AI 洞察
            </button>
          )}
        </div>
      </div>

      <p className="ai-insight-hint">
        基于统计数据生成写作趋势与习惯分析（模型：{DEFAULT_MODEL}，需已安装并登录 Ollama）
      </p>

      {error && (
        <div className="ai-insight-error" role="alert">
          {error}
          {health && !health.hasModel && (
            <p className="ai-insight-error-cmd">
              <code>ollama pull {DEFAULT_MODEL}</code>
            </p>
          )}
        </div>
      )}

      {(streaming || insight) && (
        <div className={`ai-insight-body${streaming && !insight ? ' ai-insight-body--loading' : ''}`}>
          {streaming && !insight ? (
            <div className="ai-insight-skeleton">
              <div className="ai-insight-skeleton-line" />
              <div className="ai-insight-skeleton-line" style={{ width: '85%' }} />
              <div className="ai-insight-skeleton-line" style={{ width: '70%' }} />
            </div>
          ) : (
            <div className="ai-insight-content">{insight}</div>
          )}
        </div>
      )}
    </section>
  );
});
