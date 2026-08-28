import { useState } from "react";
import type { Finding, PageInfo } from "../types";
import { pageUrl } from "../api";

const SEVERITY_STYLE: Record<string, { border: string; fill: string; label: string; text: string }> = {
  high: { border: "border-red-500", fill: "bg-red-500/25", label: "High suspicion", text: "text-red-600" },
  medium: { border: "border-orange-400", fill: "bg-orange-400/25", label: "Medium suspicion", text: "text-orange-600" },
  low: { border: "border-yellow-400", fill: "bg-yellow-400/25", label: "Low suspicion", text: "text-yellow-600" },
};

export default function PageViewer({
  jobId,
  page,
  findings,
  activeFindingId,
  onSelect,
}: {
  jobId: string;
  page: PageInfo;
  findings: Finding[];
  activeFindingId: string | null;
  onSelect: (f: Finding) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const onPage = findings.filter((f) => f.region && f.region.page === page.index);
  if (!onPage.length) return null;

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800">Page {page.index + 1}</h3>
        <div className="flex gap-3 text-[11px] text-slate-500">
          <span><span className="inline-block w-2.5 h-2.5 bg-red-500 rounded mr-1" />High</span>
          <span><span className="inline-block w-2.5 h-2.5 bg-orange-400 rounded mr-1" />Medium</span>
          <span><span className="inline-block w-2.5 h-2.5 bg-yellow-400 rounded mr-1" />Low</span>
        </div>
      </div>
      <div className="relative w-full" style={{ aspectRatio: `${page.width} / ${page.height}` }}>
        <img
          src={pageUrl(jobId, page.image)}
          alt={`document page ${page.index + 1}`}
          className="absolute inset-0 w-full h-full object-contain border rounded"
        />
        {onPage.map((f) => {
          const r = f.region!;
          const style = SEVERITY_STYLE[f.severity];
          const isActive = f.id === activeFindingId || f.id === hovered;
          return (
            <button
              key={f.id}
              onClick={() => onSelect(f)}
              onMouseEnter={() => setHovered(f.id)}
              onMouseLeave={() => setHovered(null)}
              className={`absolute rounded border-2 ${style.border} transition-all ${
                isActive ? "z-10 ring-2 ring-slate-800" : "z-0"
              }`}
              style={{
                left: `${(r.x / page.width) * 100}%`,
                top: `${(r.y / page.height) * 100}%`,
                width: `${(r.w / page.width) * 100}%`,
                height: `${(r.h / page.height) * 100}%`,
                backgroundColor: isActive ? "transparent" : undefined,
              }}
            >
              <span
                className={`absolute -top-5 left-0 text-[9px] font-semibold px-1 rounded whitespace-nowrap ${
                  style.fill} ${style.text}`}
              >
                {f.category.replace("_", " ")} · {style.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}