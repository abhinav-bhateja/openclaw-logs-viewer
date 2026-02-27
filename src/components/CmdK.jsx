import { useEffect, useRef, useState } from 'react';

export default function CmdK({ sessions, selectedSession, onSelectSession }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery('');
        setCursor(0);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const filtered = sessions.filter((s) =>
    `${s.name}${s.sessionId}`.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => setCursor(0), [query]);

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter' && filtered[cursor]) {
      pick(filtered[cursor].name);
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[cursor];
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  function pick(name) {
    onSelectSession(name);
    setOpen(false);
    setQuery('');
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
          <span className="text-slate-400 text-sm">⌘K</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to session..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-500">esc</kbd>
        </div>
        <div ref={listRef} className="no-scrollbar max-h-72 overflow-auto py-1">
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
              <div className="text-xs font-medium">{s.sessionId}</div>
              <div className="mt-0.5 text-[11px] text-slate-400">{s.name}</div>
            </button>
          ))}
        </div>
        <div className="border-t border-slate-800 px-4 py-2 text-[10px] text-slate-600">
          ↑↓ navigate · enter select · esc close
        </div>
      </div>
    </div>
  );
}
