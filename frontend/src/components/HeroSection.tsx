import AnalysisSummaryCard from "./AnalysisSummaryCard";
import DocumentPreview from "./DocumentPreview";
import { ArrowRight, CheckSmall, SparkIcon } from "./icons";

interface HeroSectionProps {
  onVerify: () => void;
  onViewSample: () => void;
}

const FEATURES = [
  "Explainable Results",
  "Highlights Suspicious Regions",
  "Multi-layer Forensic Analysis",
];

export default function HeroSection({ onVerify, onViewSample }: HeroSectionProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm px-6 py-8 sm:px-10 sm:py-10 lg:p-12">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <SparkIcon className="w-3.5 h-3.5" />
            AI-Powered Forensic Analysis
          </span>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Verify Documents.
            <br />
            Trust with{" "}
            <span className="text-indigo-600">Evidence<span className="text-slate-900">.</span></span>
          </h1>

          <p className="mt-4 max-w-md text-base leading-relaxed text-slate-500 sm:text-lg">
            DocuVerify analyzes document structure, typography, visual elements, metadata and
            content consistency to detect potential manipulations and provide explainable
            authenticity assessment.
          </p>

          <ul className="mt-6 flex flex-col gap-2.5">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckSmall className="w-3 h-3" />
                </span>
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onVerify}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              Verify a Document
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onViewSample}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              View Sample Report
            </button>
          </div>
        </div>

        <div className="relative mt-2 flex justify-center lg:mt-0">
          <div>
            <DocumentPreview />
            <AnalysisSummaryCard className="relative z-10 mx-auto mt-4 ml-auto max-w-full lg:absolute lg:mt-0 lg:-bottom-8 lg:-right-8" />
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-widest text-slate-400 lg:mt-14 lg:pl-10">
            <span>Document</span>
            <ArrowRight className="w-3 h-3" />
            <span>Forensic Analysis</span>
            <ArrowRight className="w-3 h-3" />
            <span>Suspicious Regions</span>
            <ArrowRight className="w-3 h-3" />
            <span>Explainable Findings</span>
          </div>
        </div>
      </div>
    </section>
  );
}