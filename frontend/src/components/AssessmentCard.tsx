import type { Assessment } from "../types";

const RISK_STYLES: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-red-100 text-red-700",
};

const CATEGORY_ORDER = ["typography", "layout", "visual", "semantic", "text_layer", "metadata"];

export default function AssessmentCard({ assessment }: { assessment: Assessment }) {
  const pct = Math.min(100, assessment.suspicion_score);
  const barColor = pct < 30 ? "bg-emerald-500" : pct < 65 ? "bg-amber-500" : "bg-red-500";
  const cats = [...assessment.categories].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
  );

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Authenticity Assessment</h2>
          <p className="text-sm text-slate-500">Evidence-based suspicion score</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-bold ${RISK_STYLES[assessment.risk_level]}`}>
          {assessment.risk_level} SUSPICION
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-slate-900">{assessment.suspicion_score.toFixed(1)}</span>
          <span className="text-slate-500 text-sm">/ 100</span>
        </div>
        <div className="mt-2 h-3 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {cats.map((c) => (
          <div key={c.category} className="border rounded p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600 capitalize">{c.category.replace("_", " ")}</span>
              {c.available && c.max_severity && (
                <span
                  className={`w-2 h-2 rounded-full ${
                    c.max_severity === "high"
                      ? "bg-red-500"
                      : c.max_severity === "medium"
                        ? "bg-orange-400"
                        : "bg-yellow-400"
                  }`}
                />
              )}
            </div>
            <div className="text-sm font-bold text-slate-800 capitalize">
              {c.available ? c.label : "n/a"}
            </div>
            {c.available && <div className="text-[11px] text-slate-400">{(c.score * 100).toFixed(1)}% contribution</div>}
          </div>
        ))}
      </div>
    </div>
  );
}