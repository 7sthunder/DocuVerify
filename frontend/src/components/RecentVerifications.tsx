import { useEffect, useState } from "react";
import { ArrowRight, FileIcon } from "./icons";
import SectionHeading from "./SectionHeading";
import { listJobs } from "../api";
import type { JobSummary } from "../types";

type RiskTone = "bg-red-100 text-red-700" | "bg-emerald-100 text-emerald-700" | "bg-amber-100 text-amber-700";

const RISK_TONE: Record<JobSummary["risk_level"], RiskTone> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-emerald-100 text-emerald-700",
};

const RISK_LABEL: Record<JobSummary["risk_level"], string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RecentVerifications({ onViewAll }: { onViewAll: () => void }) {
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);

  useEffect(() => {
    let alive = true;
    listJobs()
      .then((rows) => alive && setJobs(rows))
      .catch(() => alive && setJobs([]));
    return () => {
      alive = false;
    };
  }, []);

  const rows = jobs ?? [];

  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <SectionHeading
          kicker="Activity"
          title="Recent Verifications"
          description={
            rows.length
              ? "Your most recent document verifications and their outcomes."
              : "Run your first verification to see real results here."
          }
        />
        <button
          onClick={onViewAll}
          className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          View all
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3.5 font-semibold">Document</th>
                <th className="px-5 py-3.5 font-semibold">Date</th>
                <th className="px-5 py-3.5 font-semibold">Score</th>
                <th className="px-5 py-3.5 font-semibold">Risk Level</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-2.5 font-medium text-slate-800">
                      <FileIcon className="h-4 w-4 text-indigo-500" />
                      {r.filename}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{formatDate(r.created)}</td>
                  <td className="px-5 py-3.5 font-semibold text-slate-800">{Math.round(r.score)}/100</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${RISK_TONE[r.risk_level]}`}>
                      {RISK_LABEL[r.risk_level]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 text-slate-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Completed
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                    No verifications yet — run your first verification to see real results here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <ul className="divide-y divide-slate-100 md:hidden">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-4">
              <div className="flex items-center gap-2.5">
                <FileIcon className="h-4 w-4 shrink-0 text-indigo-500" />
                <span className="truncate text-sm font-medium text-slate-800">{r.filename}</span>
                <span className={`ml-auto whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${RISK_TONE[r.risk_level]}`}>
                  {RISK_LABEL[r.risk_level]}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>{formatDate(r.created)}</span>
                <span className="font-semibold text-slate-700">Score {Math.round(r.score)}/100</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Completed
                </span>
              </div>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-500">
              No verifications yet — run your first verification to see real results here.
            </li>
          )}
        </ul>
      </div>

      <div className="mt-4 sm:hidden">
        <button
          onClick={onViewAll}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
        >
          View all
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
}