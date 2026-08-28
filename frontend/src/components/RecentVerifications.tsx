import { ArrowRight, FileIcon } from "./icons";
import SectionHeading from "./SectionHeading";

interface Row {
  document: string;
  date: string;
  score: string;
  risk: { label: string; tone: "bg-red-100 text-red-700" | "bg-emerald-100 text-emerald-700" | "bg-amber-100 text-amber-700" };
  status: string;
}

const ROWS: Row[] = [
  {
    document: "Certificate_JohnDoe.pdf",
    date: "27 May 2026, 10:30 AM",
    score: "62/100",
    risk: { label: "High", tone: "bg-red-100 text-red-700" },
    status: "Completed",
  },
  {
    document: "Invoice_2026_045.png",
    date: "27 May 2026, 09:15 AM",
    score: "85/100",
    risk: { label: "Low", tone: "bg-emerald-100 text-emerald-700" },
    status: "Completed",
  },
  {
    document: "ID_Card_Employee.jpg",
    date: "26 May 2026, 04:45 PM",
    score: "44/100",
    risk: { label: "Medium", tone: "bg-amber-100 text-amber-700" },
    status: "Completed",
  },
];

export default function RecentVerifications({ onViewAll }: { onViewAll: () => void }) {
  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <SectionHeading
          kicker="Activity"
          title="Recent Verifications"
          description="Sample preview data — run your first verification to see real results here."
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
              {ROWS.map((r) => (
                <tr key={r.document} className="transition-colors hover:bg-slate-50">
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-2.5 font-medium text-slate-800">
                      <FileIcon className="h-4 w-4 text-indigo-500" />
                      {r.document}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{r.date}</td>
                  <td className="px-5 py-3.5 font-semibold text-slate-800">{r.score}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.risk.tone}`}>
                      {r.risk.label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 text-slate-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="divide-y divide-slate-100 md:hidden">
          {ROWS.map((r) => (
            <li key={r.document} className="px-4 py-4">
              <div className="flex items-center gap-2.5">
                <FileIcon className="h-4 w-4 shrink-0 text-indigo-500" />
                <span className="truncate text-sm font-medium text-slate-800">{r.document}</span>
                <span className={`ml-auto whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${r.risk.tone}`}>
                  {r.risk.label}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>{r.date}</span>
                <span className="font-semibold text-slate-700">Score {r.score}</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {r.status}
                </span>
              </div>
            </li>
          ))}
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