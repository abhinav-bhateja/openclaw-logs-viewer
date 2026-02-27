import SessionList from '@/components/SessionList';
import Logo from '@/components/Logo';

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
        className={`no-scrollbar fixed inset-y-0 left-0 z-40 w-80 border-r border-slate-800/80 bg-slate-900/95 backdrop-blur-xl transition-transform md:static md:z-auto md:flex md:w-80 md:translate-x-0 md:flex-col ${
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
          <div className="px-3 py-2 text-xs uppercase tracking-wide text-slate-400">Sessions</div>
          <div className="min-h-0 flex-1 overflow-hidden px-2.5 pb-2.5">
            <SessionList
              sessions={sessions}
              selectedSession={selectedSession}
              onSelectSession={onSelectSession}
            />
          </div>
        </div>

        <div className="mt-auto border-t border-slate-800 p-3 text-xs text-slate-400">
          Local dashboard on <span className="text-slate-200">:3099</span>
        </div>
      </aside>
    </>
  );
}
