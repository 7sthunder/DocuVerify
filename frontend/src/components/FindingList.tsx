import type { Finding } from "../types";

const SEV_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-orange-400",
  low: "bg-yellow-400",
};

export default function FindingList({
  findings,
  activeId,
  onSelect,
}: {
  findings: Finding[];
  activeId: string | null;
  onSelect: (f: Finding) => void;
}) {
  if (!findings.length) return null;
  const sorted = [...findings].sort((a, b) => a.score - b.score).reverse();

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h3 className="font-semibold text-slate-800 mb-3">Findings ({findings.length})</h3>
      <ul className="space-y-2">
        {sorted.map((f) => (
          <li key={f.id}>
            <button
              onClick={() => onSelect(f)}
              className={`w-full text-left border rounded p-3 transition ${
                f.id === activeId ? "border-slate-700 bg-slate-50" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${SEV_DOT[f.severity]}`} />
                <span className="text-sm font-semibold text-slate-800 capitalize">{f.category.replace("_", " ")}</span>
                <span className="text-[10px] uppercase tracking-wide text-slate-400">{f.module}</span>
                <span className="ml-auto text-xs font-bold text-slate-500">{Math.round(f.score * 100)}</span>
                {f.region && <span className="text-[10px] text-slate-400">region</span>}
              </div>
              <p className="mt-1 text-xs text-slate-600">{f.explanation}</p>
              {f.region && (
                <p className="mt-1 text-[10px] text-slate-400">
                  Page {f.region.page + 1} @ ({Math.round(f.region.x)}, {Math.round(f.region.y)})
                </p>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}