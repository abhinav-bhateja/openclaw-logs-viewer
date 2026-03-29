import { useState, useMemo } from 'react';
import SessionList from '@/components/SessionList';
import Logo from '@/components/Logo';
import { Sheet, SheetTrigger, SheetContent } from '@/components/ui/Sheet';

const CHANNELS = ['All', 'Discord', 'Cron', 'Direct'];

const NAV_ICONS = {
  sessions: (
    <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3.43 2.524A41.29 41.29 0 0110 2c2.236 0 4.43.18 6.57.524 1.437.231 2.43 1.49 2.43 2.902v5.148c0 1.413-.993 2.67-2.43 2.902a41.202 41.202 0 01-3.55.414c-.28.02-.521.18-.643.413l-1.712 3.293a.75.75 0 01-1.33 0l-1.713-3.293a.783.783 0 00-.642-.413 41.202 41.202 0 01-3.55-.414C1.993 13.245 1 11.986 1 10.574V5.426c0-1.413.993-2.67 2.43-2.902z" clipRule="evenodd" />
    </svg>
  ),
  commands: (
    <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M13.5 4.938a7 7 0 11-9.006 1.737c.202-.257.59-.218.793.039.278.352.594.672.943.954.332.269.786-.049.773-.476a5.977 5.977 0 01.13-2.229 6.008 6.008 0 012.899-3.644c.243-.143.558.009.608.294a5.974 5.974 0 002.86 4.325zm-2.596 8.014a.75.75 0 01-.34-1.003 3.998 3.998 0 001.242-5.11.75.75 0 011.303-.745 5.5 5.5 0 01-1.202 7.199.75.75 0 01-1.003-.34z" clipRule="evenodd" />
    </svg>
  ),
  config: (
    <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  ),
  cron: (
    <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
    </svg>
  ),
  stats: (
    <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1zM9.5 6A1.5 1.5 0 008 7.5v9A1.5 1.5 0 009.5 18h1a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0010.5 6h-1zM3.5 10A1.5 1.5 0 002 11.5v5A1.5 1.5 0 003.5 18h1A1.5 1.5 0 006 16.5v-5A1.5 1.5 0 004.5 10h-1z" />
    </svg>
  ),
};

const SORT_OPTIONS = [
  { value: 'recent', label: 'Recent first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'messages', label: 'Most messages' },
  { value: 'name', label: 'Name A-Z' },
];

function sortSessions(sessions, sortBy) {
  const sorted = [...sessions];
  switch (sortBy) {
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.modifiedAt) - new Date(b.modifiedAt));
    case 'messages':
      return sorted.sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0));
    case 'name':
      return sorted.sort((a, b) => (a.label || a.sessionId).localeCompare(b.label || b.sessionId));
    case 'recent':
    default:
      return sorted.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
  }
}

function SidebarInner({
  navItems,
  activeView,
  onViewChange,
  sessions,
  selectedSession,
  onSelectSession,
  channelFilter,
  setChannelFilter,
  sortBy,
  setSortBy,
  channelCounts,
  sortedSessions,
  filteredSessions,
}) {
  return (
    <>
      {/* Header */}
      <div className="border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Logo />
          <h1 className="text-base font-semibold tracking-tight">Logs</h1>
        </div>
      </div>

      {/* Nav tab bar */}
      <div className="flex border-b border-slate-800">
        {navItems.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              onClick={() => onViewChange(item.id)}
              className={`flex flex-1 items-center justify-center py-2.5 transition ${
                active
                  ? 'border-b-2 border-blue-400 text-blue-300'
                  : 'border-b-2 border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {NAV_ICONS[item.id] || <span className="text-xs">{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Channel filters + sort */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-2 px-3 pt-2.5 pb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-400">
              {filteredSessions.length}
            </span>
            {CHANNELS.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannelFilter(ch)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition duration-100 ${
                  channelFilter === ch
                    ? 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                {ch}
                {channelCounts[ch] != null && (
                  <span className="ml-1 text-[10px] opacity-60">{channelCounts[ch]}</span>
                )}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full rounded-lg border border-slate-700/60 bg-slate-800/50 px-2 py-1 text-[11px] text-slate-400 outline-none focus:border-blue-500/40"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Session list */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2.5">
          <SessionList
            sessions={sortedSessions}
            selectedSession={selectedSession}
            onSelectSession={onSelectSession}
          />
        </div>
      </div>
    </>
  );
}

export default function Sidebar({
  navItems,
  activeView,
  onViewChange,
  sessions,
  selectedSession,
  onSelectSession,
  mobileOpen,
  onCloseMobile,
}) {
  const [channelFilter, setChannelFilter] = useState('All');
  const [sortBy, setSortBy] = useState('recent');

  const filteredSessions = channelFilter === 'All'
    ? sessions
    : sessions.filter((s) => (s.channel || 'other') === channelFilter.toLowerCase());

  const sortedSessions = useMemo(
    () => sortSessions(filteredSessions, sortBy),
    [filteredSessions, sortBy],
  );

  const channelCounts = useMemo(() => {
    const counts = { All: sessions.length };
    for (const s of sessions) {
      const ch = s.channel || 'other';
      const key = ch.charAt(0).toUpperCase() + ch.slice(1);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [sessions]);

  const sharedProps = {
    navItems, activeView, onViewChange, sessions, selectedSession, onSelectSession,
    channelFilter, setChannelFilter, sortBy, setSortBy, channelCounts, sortedSessions, filteredSessions,
  };

  return (
    <>
      {/* Mobile: Radix Sheet */}
      <Sheet open={mobileOpen} onOpenChange={(open) => { if (!open) onCloseMobile(); }}>
        <SheetContent>
          <SidebarInner {...sharedProps} />
        </SheetContent>
      </Sheet>

      {/* Desktop: static sidebar */}
      <aside className="no-scrollbar hidden w-80 flex-col border-r border-slate-800/80 bg-slate-900/95 lg:flex">
        <SidebarInner {...sharedProps} />
      </aside>
    </>
  );
}
