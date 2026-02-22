import { fmtDate, fmtNum, pretty } from '@/lib/format';

export default function CronView({ runs, filter }) {
  const q = filter.trim().toLowerCase();
  const filtered = runs.filter((run) => !q || JSON.stringify(run).toLowerCase().includes(q));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {filtered.length ? (
        filtered.map((run) => {
          const latest = run.latest || {};
          return (
            <div
              key={run.id}
              className="border border-slate-800/70 bg-slate-950/35 p-3 transition hover:border-slate-700"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">{run.name}</div>
                <span
                  className={`rounded border px-2 py-0.5 text-xs ${
                    latest.status === 'ok'
                      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-amber-400/30 bg-amber-500/10 text-amber-300'
                  }`}
                >
                  {latest.status || 'unknown'}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Modified: {fmtDate(run.modifiedAt)} • Entries: {fmtNum((run.entries || []).length)}
              </div>
              <details className="mt-3 border border-slate-800/80 bg-slate-900/40 p-2">
                <summary className="cursor-pointer text-xs text-slate-300">View logs</summary>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-200">{pretty(run.entries)}</pre>
              </details>
            </div>
          );
        })
      ) : (
        <div className="text-sm text-slate-500">No cron runs found</div>
      )}
    </div>
  );
}
