import { memo, useCallback, useMemo, useState } from 'react';
import type { NameStatPoint, NameStatsData } from '../lib/types';
import { formatShortDisplayDate } from '../lib/dateUtils';

const DEFAULT_VISIBLE = 5;

interface NameStatsSectionProps {
  nameStats: NameStatsData;
  hasEntries: boolean;
  onWatchlistChange: () => void;
  onSearchName: (name: string) => void;
}

function buildRowTitle(item: NameStatPoint): string {
  const parts = [`${item.name}：出现 ${item.totalCount} 次，涉及 ${item.entryDays} 天`];
  if (item.lastDate) parts.push(`最近 ${formatShortDisplayDate(item.lastDate)}`);
  return parts.join('，');
}

export const NameStatsSection = memo(function NameStatsSection({
  nameStats,
  hasEntries,
  onWatchlistChange,
  onSearchName,
}: NameStatsSectionProps) {
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const saveWatchlist = useCallback(
    async (names: string[]) => {
      setSaving(true);
      try {
        await window.diaryAPI.saveNameWatchlist(names);
        onWatchlistChange();
      } finally {
        setSaving(false);
      }
    },
    [onWatchlistChange],
  );

  const handleAdd = useCallback(() => {
    const name = input.trim();
    if (!name || saving) return;
    if (nameStats.watchlist.includes(name)) {
      setInput('');
      return;
    }
    setInput('');
    void saveWatchlist([...nameStats.watchlist, name]);
  }, [input, nameStats.watchlist, saveWatchlist, saving]);

  const handleRemove = useCallback(
    (name: string) => {
      if (saving) return;
      void saveWatchlist(nameStats.watchlist.filter((n) => n !== name));
    },
    [nameStats.watchlist, saveWatchlist, saving],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const rankedStats = useMemo(
    () => nameStats.stats.filter((s) => s.totalCount > 0),
    [nameStats.stats],
  );

  const visibleStats = showAll ? rankedStats : rankedStats.slice(0, DEFAULT_VISIBLE);
  const hasMoreStats = rankedStats.length > DEFAULT_VISIBLE;
  const maxCount = Math.max(1, ...rankedStats.map((s) => s.totalCount));
  const watchCount = nameStats.watchlist.length;
  const showManagePanel = manageOpen || watchCount === 0;

  return (
    <section className="analytics-section name-stats-section">
      <div className="name-stats-header">
        <div className="name-stats-header-main">
          <h3 className="analytics-section-title">人名统计</h3>
          {watchCount > 0 && (
            <span className="name-stats-badge">{watchCount} 人</span>
          )}
        </div>
        {hasEntries && watchCount > 0 && (
          <button
            type="button"
            className="name-stats-manage-btn"
            onClick={() => setManageOpen((v) => !v)}
            aria-expanded={showManagePanel}
          >
            <span className="name-stats-manage-icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2.5 4.5h9M2.5 7h6.5M2.5 9.5h4"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span>{showManagePanel ? '收起名单' : '管理名单'}</span>
            <span className="name-stats-manage-chevron" aria-hidden="true" />
          </button>
        )}
      </div>

      {showManagePanel && (
        <div className="name-stats-manage-panel">
          <div className="name-watchlist-editor">
            <input
              type="text"
              className="name-watchlist-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入人名后添加"
              maxLength={8}
              disabled={saving}
            />
            <button
              type="button"
              className="btn-secondary name-watchlist-add"
              onClick={handleAdd}
              disabled={saving || !input.trim()}
            >
              添加
            </button>
          </div>
          {watchCount > 0 && (
            <div className="name-watch-chips">
              {nameStats.watchlist.map((name) => (
                <span key={name} className="name-watch-chip">
                  {name}
                  <button
                    type="button"
                    className="name-watch-chip-remove"
                    onClick={() => handleRemove(name)}
                    disabled={saving}
                    aria-label={`移除 ${name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {!hasEntries ? (
        <p className="name-stats-empty">还没有日记数据，写完后再来看统计</p>
      ) : watchCount === 0 ? (
        <p className="name-stats-empty">在上方添加你关心的人名，即可统计出现次数</p>
      ) : rankedStats.length === 0 ? (
        <p className="name-stats-empty">关注名单中的名字暂未在日记中出现</p>
      ) : (
        <>
          <div className="name-stats-list">
            {visibleStats.map((item, i) => (
              <div
                key={item.name}
                className="name-stats-row"
                title={buildRowTitle(item)}
              >
                <span className="name-stats-rank">{i + 1}</span>
                <button
                  type="button"
                  className="name-stats-name"
                  onClick={() => onSearchName(item.name)}
                >
                  {item.name}
                </button>
                <div className="name-stats-bar-track">
                  <div
                    className="name-stats-bar"
                    style={{
                      width: `${(item.totalCount / maxCount) * 100}%`,
                      '--bar-i': i,
                    } as React.CSSProperties}
                  />
                </div>
                <span className="name-stats-count">
                  {item.totalCount} 次 · {item.entryDays} 天
                </span>
              </div>
            ))}
          </div>
          {hasMoreStats && (
            <button
              type="button"
              className="name-stats-expand-btn"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? '收起列表' : `展开全部（${rankedStats.length} 人）`}
            </button>
          )}
        </>
      )}
    </section>
  );
});
