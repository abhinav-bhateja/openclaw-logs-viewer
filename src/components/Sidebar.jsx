import { useState } from 'react';
import SessionList from '@/components/SessionList';
import Logo from '@/components/Logo';

const CHANNELS = ['All', 'Discord', 'Cron', 'Direct'];

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

  const filteredSessions = channelFilter === 'All'
    ? sessions
    : sessions.filter((s) => (s.channel || 'other') === channelFilter.toLowerCase());

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 bg-black/45 md:hidden"
        />
      ) : null}

      <aside
        className={`no-scrollbar fixed inset-y-0 left-0 z-40 w-80 border-r border-slate-800/80 bg-slate-900/95 backdrop-blur-xl transition-transform md:static md:z-auto md:flex md:h-full md:w-80 md:translate-x-0 md:flex-col md:overflow-hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <Logo />
            <h1 className="text-base font-semibold tracking-tight">OpenClaw Log Viewer</h1>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">Sessions, logs, cron, and stats</p>
        </div>

        <nav className="space-y-1 p-2.5 text-sm">
          {navItems.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onViewChange(item.id)}
                className={`w-full border px-3 py-2 text-left transition ${
                  active
                    ? 'border-blue-500/40 bg-blue-500/15 text-blue-200'
                    : 'border-transparent text-slate-300 hover:border-slate-700/80 hover:bg-slate-800/70'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex min-h-0 flex-1 flex-col border-t border-slate-800">
          <div className="flex items-center gap-1 px-3 py-2">
            {CHANNELS.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannelFilter(ch)}
                className={`rounded-full px-2 py-0.5 text-[11px] transition duration-100 ${
                  channelFilter === ch
                    ? 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-hidden px-2.5 pb-2.5">
            <SessionList
              sessions={filteredSessions}
              selectedSession={selectedSession}
              onSelectSession={onSelectSession}
            />
          </div>
        </div>
      </aside>
    </>
  );
}
