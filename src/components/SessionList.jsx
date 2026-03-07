import { useMemo } from 'react';
import { fmtDate } from '@/lib/format';
import ChannelIcon from '@/components/ChannelIcon';
import { useTicker } from '@/hooks/useTicker';

function getDateGroup(dateStr) {
  if (!dateStr) return 'Older';
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return 'Older';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);

  if (dt >= today) return 'Today';
  if (dt >= yesterday) return 'Yesterday';
  if (dt >= weekAgo) return 'This Week';
  return 'Older';
}

const GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'Older'];

function groupSessions(sessions) {
  const groups = {};
  for (const s of sessions) {
    const g = getDateGroup(s.modifiedAt);
    (groups[g] ||= []).push(s);
  }
  return GROUP_ORDER.filter((g) => groups[g]?.length).map((g) => ({ label: g, sessions: groups[g] }));
}

export default function SessionList({ sessions, selectedSession, onSelectSession }) {
  useTicker(60_000);

  const grouped = useMemo(() => groupSessions(sessions), [sessions]);

  if (!sessions.length) {
    return <div className="px-3 py-2 text-xs text-slate-500">No sessions found</div>;
  }

  return (
    <div className="no-scrollbar h-full overflow-auto pr-1">
      {grouped.map((group) => (
        <div key={group.label} className="mb-1">
          <div className="sticky top-0 z-10 bg-slate-900/90 px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 backdrop-blur-sm">
            {group.label}
          </div>
          <div className="space-y-1">
            {group.sessions.map((session) => {
              const isActive = selectedSession === session.name;
              return (
                <button
                  key={session.name}
                  type="button"
                  title={session.sessionId}
                  onClick={() => onSelectSession(session.name)}
                  className={`w-full rounded-lg p-2.5 text-left transition ${
                    isActive
                      ? 'bg-blue-500/15 ring-1 ring-blue-500/40'
                      : 'bg-slate-800/30 hover:bg-slate-800/60'
                  } ${session.isArchived ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <ChannelIcon channel={session.channel} />
                    <span className={`min-w-0 flex-1 truncate text-sm font-medium ${session.isArchived ? 'italic' : ''}`}>
                      {session.label || session.sessionId}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                      {fmtDate(session.modifiedAt)}
                    </span>
                  </div>
                  {session.messageCount > 0 && (
                    <div className="mt-1 pl-6 text-[10px] text-slate-500">
                      {session.messageCount} messages
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
