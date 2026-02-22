import { fmtDate } from '@/lib/format';

export default function CommandsView({ commands, filter }) {
  const q = filter.trim().toLowerCase();
  const rows = commands.filter((row) => !q || JSON.stringify(row).toLowerCase().includes(q));

  return (
    <div className="overflow-auto rounded-xl border border-slate-800 bg-slate-950/70">
      <table className="w-full text-sm">
        <thead className="bg-slate-900/80 text-slate-300">
          <tr>
            <th className="border-b border-slate-800 px-3 py-2 text-left font-medium">Timestamp</th>
            <th className="border-b border-slate-800 px-3 py-2 text-left font-medium">Action</th>
            <th className="border-b border-slate-800 px-3 py-2 text-left font-medium">Session Key</th>
            <th className="border-b border-slate-800 px-3 py-2 text-left font-medium">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, idx) => (
              <tr key={`${row.timestamp || 'row'}-${idx}`} className="border-b border-slate-800/70 transition hover:bg-slate-900/70">
                <td className="px-3 py-2">{fmtDate(row.timestamp)}</td>
                <td className="px-3 py-2">
                  <span className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs">
                    {row.action || '-'}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-300">{row.sessionKey || '-'}</td>
                <td className="px-3 py-2">{row.source || '-'}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-3 py-3 text-slate-500" colSpan={4}>
                No records
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
