import { fmtDate } from '@/lib/format';
import { useTicker } from '@/hooks/useTicker';

export default function SessionList({ sessions, selectedSession, onSelectSession }) {
  useTicker(60_000);
  if (!sessions.length) {
    return <div className="px-3 py-2 text-xs text-slate-500">No sessions found</div>;
  }

  return (
    <div className="no-scrollbar h-full space-y-1.5 overflow-auto pr-1">
      {sessions.map((session) => {
        const isActive = selectedSession === session.name;
        return (
          <button
            key={session.name}
            type="button"
            onClick={() => onSelectSession(session.name)}
            className={`w-full border bg-slate-900/45 p-2.5 text-left transition ${
              isActive
                ? 'ring-1 ring-blue-500 border-blue-600/45'
                : 'border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{session.label || session.sessionId}</div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="font-mono">{session.sessionId.slice(0, 8)}</span>
                  <span>·</span>
                  <span className="tabular-nums">{fmtDate(session.modifiedAt)}</span>
                  {session.messageCount > 0 && (
                    <>
                      <span>·</span>
                      <span>{session.messageCount}msg</span>
                    </>
                  )}
                </div>
              </div>
              <span
                className={`mt-0.5 shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] ${
                  session.isArchived
                    ? 'border-slate-700 text-slate-500'
                    : 'border-emerald-400/30 text-emerald-400'
                }`}
              >
                {session.isArchived ? 'arch' : '●'}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
