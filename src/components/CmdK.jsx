import { useEffect, useRef, useState, useCallback } from 'react';

export default function CmdK({ sessions, selectedSession, onSelectSession, open: openProp, onOpenChange }) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = openProp !== undefined ? openProp : localOpen;
  function setOpen(val) {
    setLocalOpen(val);
    onOpenChange?.(val);
  }
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery('');
        setCursor(0);
        setSearchResults(null);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // Cross-session search with debounce
  const doSearch = useCallback(async (q) => {
    if (q.length < 3) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const filtered = sessions.filter((s) =>
    `${s.name}${s.sessionId}${s.label || ''}`.toLowerCase().includes(query.toLowerCase())
  );

  const items = searchResults && query.length >= 3 ? searchResults : null;

  useEffect(() => setCursor(0), [query]);

  function onKeyDown(e) {
    const list = items || filtered;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, list.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      if (items && items[cursor]) {
        pick(items[cursor].session.fileId);
      } else if (filtered[cursor]) {
        pick(filtered[cursor].name);
      }
    }
  }

  useEffect(() => {
    const el = listRef.current?.children[cursor];
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  function pick(name) {
    onSelectSession(name);
    setOpen(false);
    setQuery('');
    setSearchResults(null);
  }

  function highlightMatch(text, q) {
    if (!q) return text;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase()
        ? <mark key={i} className="bg-blue-500/25 text-blue-200 rounded px-0.5">{part}</mark>
        : part
    );
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
          <span className="text-slate-400 text-sm">⌘K</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search across all sessions..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          {searching && <span className="text-[10px] text-slate-500 animate-pulse">Searching...</span>}
          <kbd className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-500">esc</kbd>
        </div>
        <div ref={listRef} className="no-scrollbar max-h-80 overflow-auto py-1">
          {items ? (
            items.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500">No results for &ldquo;{query}&rdquo;</div>
            ) : (
              items.map((result, i) => (
                <button
                  key={result.session.fileId}
                  type="button"
                  onClick={() => pick(result.session.fileId)}
                  className={`w-full px-4 py-2.5 text-left transition ${
                    i === cursor ? 'bg-blue-500/15 text-blue-200' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{result.session.label}</span>
                    <span className="text-[10px] text-slate-500">{result.session.channel}</span>
                    <span className="ml-auto text-[10px] text-slate-500">{result.matches.length} match{result.matches.length !== 1 ? 'es' : ''}</span>
                  </div>
                  {result.matches.slice(0, 2).map((m, j) => (
                    <div key={j} className="mt-1 truncate text-[11px] text-slate-400">
                      {highlightMatch(m.snippet, query)}
                    </div>
                  ))}
                </button>
              ))
            )
          ) : (
            <>
              {filtered.length === 0 && (
                <div className="px-4 py-3 text-sm text-slate-500">No sessions match</div>
              )}
              {filtered.map((s, i) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => pick(s.name)}
                  className={`w-full px-4 py-2.5 text-left transition ${
                    i === cursor
                      ? 'bg-blue-500/15 text-blue-200'
                      : selectedSession === s.name
                      ? 'bg-slate-800/60 text-slate-200'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-medium">{s.label || s.sessionId}</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">{s.sessionId.slice(0, 8)}</div>
                </button>
              ))}
            </>
          )}
        </div>
        <div className="border-t border-slate-800 px-4 py-2 text-[10px] text-slate-600">
          ↑↓ navigate · enter select · esc close · type 3+ chars to search content
        </div>
      </div>
    </div>
  );
}
