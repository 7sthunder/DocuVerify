import { useMemo } from "react";
import type { Assessment, Finding } from "../types";
import AssessmentCard from "./AssessmentCard";
import FindingList from "./FindingList";
import DocumentPreview from "./DocumentPreview";
import { CloseIcon } from "./icons";

const SAMPLE_ASSESSMENT: Assessment = {
  suspicion_score: 62,
  risk_level: "HIGH",
  categories: [
    { category: "typography", label: "Typography", available: true, max_severity: "high", score: 0.81, findings_count: 1 },
    { category: "layout", label: "Layout", available: true, max_severity: null, score: 0.22, findings_count: 0 },
    { category: "visual", label: "Visual elements", available: true, max_severity: null, score: 0.18, findings_count: 0 },
    { category: "semantic", label: "Content consistency", available: true, max_severity: "high", score: 0.76, findings_count: 1 },
    { category: "text_layer", label: "Text layer", available: true, max_severity: null, score: 0.0, findings_count: 0 },
    { category: "metadata", label: "Metadata", available: true, max_severity: "medium", score: 0.58, findings_count: 1 },
  ],
  disclaimer:
    "Evidence-based assessment to assist human verification. This report does not constitute proof of authenticity.",
};

const SAMPLE_FINDINGS: Finding[] = [
  {
    id: "sample-typography",
    category: "typography",
    module: "typography",
    severity: "high",
    score: 0.81,
    confidence: 0.9,
    region: null,
    evidence: [
      "Font family mismatch between certificate header and recipient name",
      "Mixed font sizes across consecutive lines in the body block",
    ],
    explanation:
      "Typography signals differ between the certificate title and the recipient field, a common pattern when content is inserted into an existing template.",
    fields: {},
  },
  {
    id: "sample-semantic",
    category: "semantic",
    module: "semantic",
    severity: "high",
    score: 0.76,
    confidence: 0.85,
    region: null,
    evidence: ["CGPA value 8.75 conflicts with the awarding body's published grade bands"],
    explanation:
      "The claimed grade is outside the official grading scale, indicating that document content is inconsistent with external ground truth.",
    fields: {},
  },
  {
    id: "sample-metadata",
    category: "metadata",
    module: "metadata",
    severity: "medium",
    score: 0.58,
    confidence: 0.7,
    region: null,
    evidence: ["Creation timestamp post-dates the issue date printed on the certificate"],
    explanation:
      "The file's embedded creation date conflicts with the date printed on the document, a possible sign of back-dating.",
    fields: {},
  },
];

export default function SampleReportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const serialById = useMemo(() => {
    const m: Record<string, number> = {};
    [...SAMPLE_FINDINGS]
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .forEach((f, i) => (m[f.id] = i + 1));
    return m;
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sample analysis report"
    >
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-50 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white">
              Sample Analysis
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Sample forensic report</h2>
              <p className="text-xs text-slate-500">
                Fictional demo results shown for illustration — not from a real verification.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Submitting document
            </p>
            <div className="flex justify-center rounded-xl border border-slate-200 bg-white p-6">
              <DocumentPreview />
            </div>
            <ol className="mt-4 space-y-2 text-sm text-slate-600">
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  1
                </span>
                Recipient name region — typography mismatch highlighted
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  2
                </span>
                CGPA field — value conflicts with official grade bands
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                  3
                </span>
                Issue date — metadata anomaly on creation timestamp
              </li>
            </ol>
          </div>

          <div className="space-y-4">
            <AssessmentCard assessment={SAMPLE_ASSESSMENT} />
            <FindingList findings={SAMPLE_FINDINGS} activeId={null} onSelect={() => {}} page={1} onPageChange={() => {}} serialById={serialById} />
          </div>
        </div>
      </div>
    </div>
  );
}