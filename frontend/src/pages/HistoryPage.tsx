import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HistoryIcon } from "../components/icons";
import { listJobs } from "../api";
import type { JobSummary } from "../types";

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listJobs()
      .then((rows) => alive && setJobs(rows))
      .catch(() => {
        alive && setError("Could not load verification history.");
        alive && setJobs([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const rows = jobs ?? [];

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <HistoryIcon className="w-7 h-7 text-indigo-600" />
        <h1 className="text-2xl font-bold text-slate-800">Verification history</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Every document you verify is recorded here with its score, risk level and findings.
        Click any row to reopen the analysis.
      </p>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
          <p className="text-sm text-slate-500 mb-4">No verifications yet — run your first verification to see real results here.</p>
          <button
            onClick={() => navigate("/verify")}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
          >
            Verify a document
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                <tr
                  key={r.id}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                  onClick={() => navigate(`/verify?job=${r.id}`)}
                >
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-2.5 font-medium text-slate-800">
                      <span className="h-4 w-4 text-indigo-500">{"\u{1F4C4}"}</span>
                      {r.filename}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{formatDate(r.created)}</td>
                  <td className="px-5 py-3.5 font-semibold text-slate-800">{Math.round(r.score)}/100</td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{
                        backgroundColor:
                          r.risk_level === "HIGH" ? "#fee2e2" : r.risk_level === "MEDIUM" ? "#fef3c7" : "#d1fae5",
                        color:
                          r.risk_level === "HIGH" ? "#b91c1c" : r.risk_level === "MEDIUM" ? "#92400e" : "#065f46",
                      }}
                    >
                      {r.risk_level}
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
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
