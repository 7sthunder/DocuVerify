import { useEffect } from "react";
import type { Finding } from "../types";

const PAGE_SIZE = 5;

const SEV_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-orange-400",
  low: "bg-yellow-400",
};

export default function FindingList({
  findings,
  activeId,
  onSelect,
  page,
  onPageChange,
  serialById,
  blinkSignal,
}: {
  findings: Finding[];
  activeId: string | null;
  onSelect: (f: Finding) => void;
  page: number;
  onPageChange: (p: number) => void;
  serialById: Record<string, number>;
  blinkSignal?: { id: string; n: number } | null;
}) {
  const sorted = [...findings].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = sorted.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    if (!activeId) return;
    const el = document.getElementById(activeId);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeId, safePage]);

  if (!findings.length) return null;

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800">Findings ({findings.length})</h3>
        <span className="text-[11px] text-slate-400">
          Page {safePage} of {pageCount}
        </span>
      </div>
      <ul className="space-y-2">
        {visible.map((f) => {
          const serial = serialById[f.id] ?? 0;
          const blinking = blinkSignal?.id === f.id;
          return (
            <li key={f.id}>
              <button
                id={f.id}
                key={blinking ? `${f.id}-${blinkSignal!.n}` : undefined}
                onClick={() => onSelect(f)}
                className={`w-full text-left border rounded p-3 transition ${
                  f.id === activeId ? "border-slate-700 bg-slate-50" : "border-slate-200 hover:bg-slate-50"
                } ${blinking ? "region-blink" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${SEV_DOT[f.severity]}`} />
                  <span className="text-[10px] font-bold text-slate-400">#{serial}</span>
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
          );
        })}
      </ul>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <button
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Prev
        </button>
        <span className="text-[11px] text-slate-400">
          #{start + 1}–{Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
        </span>
        <button
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= pageCount}
          className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}