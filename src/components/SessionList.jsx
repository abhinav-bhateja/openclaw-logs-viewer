import { fmtDate } from '@/lib/format';
import { useTicker } from '@/hooks/useTicker';

export default function SessionList({ sessions, selectedSession, onSelectSession }) {
  useTicker(60_000);
  if (!sessions.length) {
    return <div className="px-3 py-2 text-xs text-slate-500">No sessions found</div>;
  }

  return (
    <div className="no-scrollbar space-y-1.5 overflow-auto pr-1">
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
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{session.label || session.sessionId}</div>
                <div className="mt-1 truncate text-[11px] text-slate-400">{session.sessionId.slice(0, 8)}</div>
              </div>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] ${
                  session.isArchived
                    ? 'border-amber-400/30 bg-amber-500/20 text-amber-300'
                    : 'border-emerald-400/30 bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {session.isArchived ? 'Archived' : 'Active'}
              </span>
            </div>
            <div className="mt-2 text-[10px] text-slate-500">{fmtDate(session.modifiedAt)}</div>
          </button>
        );
      })}
    </div>
  );
}
