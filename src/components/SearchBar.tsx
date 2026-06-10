import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { SearchResult } from '../lib/types';
import { formatDisplayDate } from '../lib/dateUtils';

interface SearchBarProps {
  onSelectDate: (date: string, searchQuery?: string) => void;
}

function SearchIcon() {
  return (
    <svg
      className="search-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </svg>
  );
}

const HighlightSnippet = memo(function HighlightSnippet({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <mark className="search-highlight">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
});

const MIN_QUERY_LENGTH = 1;
const SEARCH_DEBOUNCE_MS = 400;

export const SearchBar = memo(function SearchBar({ onSelectDate }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchSeqRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setExpanded(false);
      setSearching(false);
      setActiveIndex(-1);
      return;
    }

    const seq = ++searchSeqRef.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await window.diaryAPI.searchEntries(trimmed);
        if (seq !== searchSeqRef.current) return;
        setResults(found);
        setExpanded(true);
        setActiveIndex(found.length > 0 ? 0 : -1);
      } finally {
        if (seq === searchSeqRef.current) {
          setSearching(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const handleSelect = useCallback(
    (date: string) => {
      onSelectDate(date, query.trim() || undefined);
      setExpanded(false);
      setQuery('');
      setActiveIndex(-1);
    },
    [onSelectDate, query],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      if (!focused && !expanded) return;

      if (e.key === 'Escape') {
        setExpanded(false);
        inputRef.current?.blur();
        return;
      }

      if (!expanded || results.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        handleSelect(results[activeIndex].date);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focused, expanded, results, activeIndex, handleSelect]);

  const trimmedQuery = query.trim();
  const showPanel = expanded && trimmedQuery.length > 0;
  const showResults = showPanel && trimmedQuery.length >= MIN_QUERY_LENGTH;

  return (
    <div className="search-bar" ref={containerRef}>
      <div className={`search-input-wrap${focused ? ' focused' : ''}`}>
        <SearchIcon />
        <input
          ref={inputRef}
          type="text"
          role="searchbox"
          className="search-input"
          placeholder="搜索日记... (Ctrl+K)"
          aria-label="搜索日记"
          autoComplete="off"
          value={query}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => setQuery(e.target.value)}
        />
        {searching && <span className="search-status">搜索中</span>}
        {query && !searching && (
          <button
            type="button"
            className="search-clear"
            onClick={() => {
              setQuery('');
              setExpanded(false);
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
            aria-label="清除搜索"
          >
            ×
          </button>
        )}
      </div>

      {showResults && (
        <div className="search-results scrollbar-pill" role="listbox">
          {results.length === 0 ? (
            <p className="search-empty">未找到匹配结果</p>
          ) : (
            <>
              <p className="search-results-count">找到 {results.length} 条结果</p>
              {results.map((r, index) => (
                <button
                  key={r.date}
                  type="button"
                  className={`search-result-item${index === activeIndex ? ' active' : ''}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => handleSelect(r.date)}
                >
                  <span className="search-result-date">{formatDisplayDate(r.date)}</span>
                  <span className="search-result-snippet">
                    <HighlightSnippet text={r.snippet} query={trimmedQuery} />
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
});
