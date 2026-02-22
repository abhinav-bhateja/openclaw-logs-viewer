import { fmtCost, fmtNum } from '@/lib/format';

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

export default function StatsView({ stats }) {
  if (!stats) {
    return <div className="text-sm text-slate-500">No stats available</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Total Sessions"
        value={fmtNum(stats.totalSessions)}
        hint={`${fmtNum(stats.activeSessions)} active • ${fmtNum(stats.archivedSessions)} archived`}
      />
      <StatCard label="Total Messages" value={fmtNum(stats.totalMessages)} hint="Across all session files" />
      <StatCard
        label="Tokens Used"
        value={fmtNum(stats.tokens.total)}
        hint={`Input ${fmtNum(stats.tokens.input)} • Output ${fmtNum(stats.tokens.output)}`}
      />
      <StatCard label="Total Cost" value={fmtCost(stats.costs.total)} hint="Aggregated from message usage" />
    </div>
  );
}
