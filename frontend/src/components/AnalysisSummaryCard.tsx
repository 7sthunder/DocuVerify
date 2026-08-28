const FINDINGS = [
  { label: "Typography Mismatch", severity: "High", tone: "bg-red-500" },
  { label: "Content Inconsistency", severity: "High", tone: "bg-red-500" },
  { label: "Date Anomaly", severity: "Medium", tone: "bg-amber-500" },
];

export default function AnalysisSummaryCard({ className }: { className?: string }) {
  return (
    <div
      className={`w-64 rounded-xl border border-slate-200 bg-white shadow-xl ${className ?? ""}`}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Analysis Summary
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Demo
        </span>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] text-slate-400">Score</div>
            <div className="text-2xl font-bold text-red-600">
              62<span className="text-sm font-medium text-slate-400">/100</span>
            </div>
          </div>
          <div className="pb-1 text-right">
            <div className="text-[11px] text-slate-400">Risk Level</div>
            <span className="mt-0.5 inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
              High
            </span>
          </div>
        </div>

        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-[62%] rounded-full bg-red-500" />
        </div>

        <div className="mt-3 border-t border-slate-100 pt-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Findings
          </div>
          <ul className="mt-1.5 space-y-1.5">
            {FINDINGS.map((f) => (
              <li key={f.label} className="flex items-center gap-2 text-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${f.tone}`} />
                <span className="text-slate-600">{f.label}</span>
                <span className="ml-auto text-[11px] font-semibold text-slate-400">
                  {f.severity}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}