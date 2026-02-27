import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import MessageView from '@/components/MessageView';
import CommandsView from '@/components/CommandsView';
import ConfigAuditView from '@/components/ConfigAuditView';
import CronView from '@/components/CronView';
import StatsView from '@/components/StatsView';
import { useWebSocket } from '@/hooks/useWebSocket';
import { mapMessageRecord } from '@/lib/format';
import CmdK from '@/components/CmdK';
import Skeleton from '@/components/Skeleton';

const NAV_ITEMS = [
  { id: 'sessions', label: 'Sessions' },
  { id: 'commands', label: 'Commands' },
  { id: 'config', label: 'Config Audit' },
  { id: 'cron', label: 'Cron' },
  { id: 'stats', label: 'Stats' },
];

function getJson(url) {
  return fetch(url).then(async (res) => {
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || `HTTP ${res.status}`);
    }
    return res.json();
  });
}

function parseHash(hash) {
  const trimmed = (hash || '').replace(/^#\/?/, '');
  if (!trimmed) return { view: 'sessions', session: null };

  const [rawView, ...rest] = trimmed.split('/');
  const view = NAV_ITEMS.some((item) => item.id === rawView) ? rawView : 'sessions';

  if (view !== 'sessions') {
    return { view, session: null };
  }

  const session = rest.length ? decodeURIComponent(rest.join('/')) : null;
  return { view, session };
}

function toHash(view, session) {
  if (view === 'sessions' && session) {
    return `#/sessions/${encodeURIComponent(session)}`;
  }
  return `#/${view}`;
}

export default function App() {
  const [view, setView] = useState('sessions');
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [commands, setCommands] = useState([]);
  const [configEvents, setConfigEvents] = useState([]);
  const [cronRuns, setCronRuns] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const filterInputRef = useRef(null);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsReconnecting, setWsReconnecting] = useState(false);

  const setHash = useCallback((nextView, nextSession = null) => {
    const hash = toHash(nextView, nextSession);
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
  }, []);

  const loadSessionDetail = useCallback(async (name) => {
    if (!name) {
      setSessionData(null);
      return;
    }
    const detail = await getJson(`/api/sessions/${encodeURIComponent(name)}`);
    setSessionData(detail);
  }, []);

  const refreshCurrent = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const sessionsPayload = await getJson('/api/sessions');
      const sessionRows = sessionsPayload.sessions || [];
      setSessions(sessionRows);

      const { session: routeSession } = parseHash(window.location.hash);
      const fallbackActive = sessionRows.find((session) => !session.isArchived)?.name;
      const fallbackAny = sessionRows[0]?.name || null;

      let nextSelected = selectedSession;
      if (routeSession && sessionRows.some((session) => session.name === routeSession)) {
        nextSelected = routeSession;
      }
      if (!nextSelected || !sessionRows.some((session) => session.name === nextSelected)) {
        nextSelected = fallbackActive || fallbackAny;
      }

      if (nextSelected !== selectedSession) {
        setSelectedSession(nextSelected || null);
      }

      if (view === 'sessions') {
        await loadSessionDetail(nextSelected);
      }

      if (view === 'commands') {
        const payload = await getJson('/api/logs/commands');
        setCommands(payload.commands || []);
      }

      if (view === 'config') {
        const payload = await getJson('/api/logs/config-audit');
        setConfigEvents(payload.events || []);
      }

      if (view === 'cron') {
        const payload = await getJson('/api/cron');
        setCronRuns(payload.runs || []);
      }

      if (view === 'stats') {
        const payload = await getJson('/api/stats');
        setStats(payload);
      }
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [loadSessionDetail, selectedSession, view]);

  useEffect(() => {
    document.documentElement.classList.add('dark');

    const applyHash = () => {
      const parsed = parseHash(window.location.hash);
      setView(parsed.view);
      if (parsed.session) {
        setSelectedSession(parsed.session);
      }
    };

    applyHash();
    window.addEventListener('hashchange', applyHash);

    function onSlash(e) {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        filterInputRef.current?.focus();
        filterInputRef.current?.select();
      }
    }
    window.addEventListener('keydown', onSlash);

    return () => {
      window.removeEventListener('hashchange', applyHash);
      window.removeEventListener('keydown', onSlash);
    };
  }, []);

  useEffect(() => {
    refreshCurrent();
  }, [refreshCurrent]);

  const handleWebSocketMessage = useCallback(
    (payload) => {
      if (!payload || !selectedSession) return;

      if (payload.type === 'reset') {
        loadSessionDetail(selectedSession).catch(() => {});
        return;
      }

      if (payload.type !== 'line' || !payload.record) {
        return;
      }

      setSessionData((current) => {
        if (!current) return current;

        const record = payload.record;
        const next = {
          ...current,
          messages: [...(current.messages || [])],
          events: [...(current.events || [])],
          parseErrors: [...(current.parseErrors || [])],
        };

        if (record._parseError) {
          next.parseErrors.push(record);
          return next;
        }

        if (record.type === 'message' && record.message) {
          next.messages.push(mapMessageRecord(record));
          return next;
        }

        if (record.type === 'session') {
          next.meta = record;
          return next;
        }

        next.events.push(record);
        return next;
      });
    },
    [loadSessionDetail, selectedSession]
  );

  const handleWebSocketError = useCallback(() => {
    setWsConnected(false);
  }, []);

  const handleWebSocketOpen = useCallback(() => {
    setWsConnected(true);
    setWsReconnecting(false);
  }, []);

  const handleWebSocketClose = useCallback(() => {
    setWsConnected(false);
    setWsReconnecting(true);
  }, []);

  useWebSocket({
    sessionName: selectedSession,
    enabled: Boolean(selectedSession),
    onMessage: handleWebSocketMessage,
    onError: handleWebSocketError,
    onOpen: handleWebSocketOpen,
    onClose: handleWebSocketClose,
  });

  // Reload session data when tab becomes visible again (catches missed WS messages)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && selectedSession) {
        loadSessionDetail(selectedSession).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [selectedSession, loadSessionDetail]);
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const payload = await getJson('/api/sessions');
        setSessions(payload.sessions || []);
      } catch {
        // silent
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  function onViewChange(nextView) {
    setMobileOpen(false);
    setFilter('');
    setView(nextView);
    if (nextView === 'sessions') {
      setHash('sessions', selectedSession);
    } else {
      setHash(nextView);
    }
  }

  function onSelectSession(name) {
    setMobileOpen(false);
    setView('sessions');
    setSelectedSession(name);
    setHash('sessions', name);
  }

  const visibleSessions = useMemo(() => {
    if (view !== 'sessions') {
      return sessions;
    }

    const q = filter.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((session) => {
      return `${session.name}${session.sessionId}${session.label || ''}`.toLowerCase().includes(q);
    });
  }, [filter, sessions, view]);

  const title = NAV_ITEMS.find((item) => item.id === view)?.label || 'Logs';

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.16),transparent_42%),radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_40%)] bg-slate-950 text-slate-100">
      <div className="flex h-full">
        <Sidebar
          navItems={NAV_ITEMS}
          activeView={view}
          onViewChange={onViewChange}
          sessions={visibleSessions}
          selectedSession={selectedSession}
          onSelectSession={onSelectSession}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-2 border-b border-slate-800/80 bg-slate-900/55 px-3 py-2 sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileOpen((prev) => !prev)}
                className="rounded-md border border-slate-700 px-2 py-1 text-[11px] font-medium transition duration-100 hover:bg-slate-800 md:hidden"
              >
                Menu
              </button>
              <h2 className="truncate text-sm font-semibold tracking-tight sm:text-base">{title}</h2>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCmdkOpen(true)}
                className="hidden h-8 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900/60 px-2.5 text-[11px] text-slate-500 transition duration-100 hover:border-slate-600 hover:text-slate-300 sm:flex"
              >
                <span>Jump to session</span>
                <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[10px]">⌘K</kbd>
              </button>
              <div className="relative">
                <input
                  type="text"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder="Filter messages"
                  ref={filterInputRef}
                  className="h-8 w-40 rounded-md border border-slate-700 bg-slate-950 pl-2.5 pr-8 text-xs placeholder:text-slate-500 transition focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/40 sm:w-56"
                />
                {!filter && (
                  <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[10px] text-slate-500">/</kbd>
                )}
              </div>
              <button
                type="button"
                onClick={async () => { setRefreshing(true); await refreshCurrent(); setRefreshing(false); }}
                disabled={refreshing}
                className="flex h-8 items-center gap-1.5 rounded-md border border-blue-500/35 bg-blue-600/80 px-2.5 text-[11px] font-semibold transition duration-100 hover:bg-blue-500 disabled:opacity-60"
              >
                {refreshing ? (
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                  </svg>
                ) : null}
                {refreshing ? 'Refreshing' : 'Refresh'}
              </button>
            </div>
          </header>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-2 sm:px-3 sm:py-3">
            {error ? (
              <div className="border border-red-700/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error.message || String(error)}
              </div>
            ) : (loading && sessions.length === 0) ? (
              <Skeleton />
            ) : view === 'sessions' ? (
              <MessageView sessionData={sessionData} filter={filter} onRefresh={refreshCurrent} wsConnected={wsConnected} wsReconnecting={wsReconnecting} />
            ) : view === 'commands' ? (
              <CommandsView commands={commands} filter={filter} />
            ) : view === 'config' ? (
              <ConfigAuditView events={configEvents} filter={filter} />
            ) : view === 'cron' ? (
              <CronView runs={cronRuns} filter={filter} />
            ) : (
              <StatsView stats={stats} />
            )}
          </section>
        </main>
      </div>
      <CmdK sessions={sessions} selectedSession={selectedSession} onSelectSession={onSelectSession} open={cmdkOpen} onOpenChange={setCmdkOpen} />
    </div>
  );
}
