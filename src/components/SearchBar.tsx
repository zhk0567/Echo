import { useEffect, useRef, useState } from 'react';
import type { SearchResult } from '../lib/types';
import { formatDisplayDate } from '../lib/dateUtils';

interface SearchBarProps {
  onSelectDate: (date: string) => void;
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

function HighlightSnippet({ text, query }: { text: string; query: string }) {
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
}

export function SearchBar({ onSelectDate }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setExpanded(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await window.diaryAPI.searchEntries(query);
        setResults(found);
        setExpanded(true);
      } finally {
        setSearching(false);
      }
    }, 300);

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape' && focused) {
        setExpanded(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focused]);

  const handleSelect = (date: string) => {
    onSelectDate(date);
    setExpanded(false);
    setQuery('');
  };

  return (
    <div className="search-bar" ref={containerRef}>
      <div className={`search-input-wrap${focused ? ' focused' : ''}`}>
        <SearchIcon />
        <input
          ref={inputRef}
          type="search"
          className="search-input"
          placeholder="搜索日记... (Ctrl+K)"
          value={query}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => setQuery(e.target.value)}
        />
        {searching && <span className="search-status">搜索中</span>}
        {query && !searching && (
          <button
            className="search-clear"
            onClick={() => {
              setQuery('');
              setExpanded(false);
              inputRef.current?.focus();
            }}
            aria-label="清除搜索"
          >
            ×
          </button>
        )}
      </div>

      {expanded && query.trim() && (
        <div className="search-results">
          {results.length === 0 ? (
            <p className="search-empty">未找到匹配结果</p>
          ) : (
            <>
              <p className="search-results-count">找到 {results.length} 条结果</p>
              {results.map((r) => (
                <button
                  key={r.date}
                  className="search-result-item"
                  onClick={() => handleSelect(r.date)}
                >
                  <span className="search-result-date">{formatDisplayDate(r.date)}</span>
                  <span className="search-result-snippet">
                    <HighlightSnippet text={r.snippet} query={query} />
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
