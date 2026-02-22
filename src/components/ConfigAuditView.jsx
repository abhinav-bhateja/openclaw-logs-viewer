import { fmtDate } from '@/lib/format';

export default function ConfigAuditView({ events, filter }) {
  const q = filter.trim().toLowerCase();
  const rows = events.filter((row) => !q || JSON.stringify(row).toLowerCase().includes(q));

  return (
    <div className="h-full overflow-auto border border-slate-800/70 bg-slate-950/35">
      <table className="w-full text-sm">
        <thead className="bg-slate-900/80 text-slate-300">
          <tr>
            <th className="border-b border-slate-800 px-3 py-2 text-left font-medium">Timestamp</th>
            <th className="border-b border-slate-800 px-3 py-2 text-left font-medium">Event</th>
            <th className="border-b border-slate-800 px-3 py-2 text-left font-medium">Previous Hash</th>
            <th className="border-b border-slate-800 px-3 py-2 text-left font-medium">Next Hash</th>
            <th className="border-b border-slate-800 px-3 py-2 text-left font-medium">Suspicious</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, idx) => {
              const suspicious = Array.isArray(row.suspicious) && row.suspicious.length > 0;
              return (
                <tr
                  key={`${row.ts || 'row'}-${idx}`}
                  className={`border-b border-slate-800/70 transition hover:bg-slate-900/70 ${
                    suspicious ? 'bg-red-500/10' : ''
                  }`}
                >
                  <td className="px-3 py-2">{fmtDate(row.ts)}</td>
                  <td className="px-3 py-2">{row.event || '-'}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-300">{(row.previousHash || '-').slice(0, 14)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-300">{(row.nextHash || '-').slice(0, 14)}</td>
                  <td className="px-3 py-2">
                    {suspicious ? (
                      <span className="font-semibold text-red-300">{row.suspicious.join(', ')}</span>
                    ) : (
                      <span className="text-slate-500">none</span>
                    )}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td className="px-3 py-3 text-slate-500" colSpan={5}>
                No records
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
