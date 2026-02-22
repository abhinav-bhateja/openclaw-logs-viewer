import SessionList from '@/components/SessionList';

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
        className={`fixed inset-y-0 left-0 z-40 w-80 border-r border-slate-800/80 bg-slate-900/95 backdrop-blur-xl transition-transform md:static md:z-auto md:flex md:w-80 md:translate-x-0 md:flex-col ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-slate-800 px-5 py-5">
          <h1 className="text-lg font-semibold tracking-tight">OpenClaw Log Viewer</h1>
          <p className="mt-1 text-xs text-slate-400">Sessions, logs, cron, and stats</p>
        </div>

        <nav className="space-y-1 p-3 text-sm">
          {navItems.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onViewChange(item.id)}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                  active
                    ? 'border-blue-500/40 bg-blue-500/15 text-blue-200'
                    : 'border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/80'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex min-h-0 flex-1 flex-col border-t border-slate-800">
          <div className="px-4 py-3 text-xs uppercase tracking-wide text-slate-400">Sessions</div>
          <div className="min-h-0 flex-1 px-3 pb-3">
            <SessionList
              sessions={sessions}
              selectedSession={selectedSession}
              onSelectSession={onSelectSession}
            />
          </div>
        </div>

        <div className="mt-auto border-t border-slate-800 p-4 text-xs text-slate-400">
          Local dashboard on <span className="text-slate-200">:3099</span>
        </div>
      </aside>
    </>
  );
}
