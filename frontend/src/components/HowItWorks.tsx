import type { ReactNode } from "react";
import { AlertIcon, ArrowRight, PenToolIcon, ScanIcon, UploadIcon, type IconProps } from "./icons";
import SectionHeading from "./SectionHeading";

const STEPS: { n: string; title: string; desc: string; icon: (p: IconProps) => ReactNode }[] = [
  {
    n: "01",
    title: "Upload",
    desc: "Upload your document in PDF, JPG or PNG format.",
    icon: (p) => <UploadIcon {...p} />,
  },
  {
    n: "02",
    title: "Analyze",
    desc: "Our AI analyzes multiple forensic signals and extracts evidence.",
    icon: (p) => <ScanIcon {...p} />,
  },
  {
    n: "03",
    title: "Detect",
    desc: "Suspicious patterns and inconsistencies are detected.",
    icon: (p) => <AlertIcon {...p} />,
  },
  {
    n: "04",
    title: "Explain",
    desc: "Get an authenticity assessment with clear explanations.",
    icon: (p) => <PenToolIcon {...p} />,
  },
];

export default function HowItWorks() {
  return (
    <section>
      <SectionHeading
        kicker="Process"
        title="How it works"
        description="A transparent four-step forensic pipeline turns any document into an evidence-backed assessment."
      />
      <div className="mt-6 flex flex-col items-stretch gap-3 lg:flex-row lg:items-stretch lg:gap-4">
        {STEPS.map((s, i) => (
          <div key={s.n} className="contents">
            <div className="relative flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center justify-center rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
                  {s.icon({ className: "w-5 h-5" })}
                </span>
                <span className="text-xs font-bold tracking-widest text-slate-300">{s.n}</span>
              </div>
              <h3 className="mt-4 text-sm font-bold uppercase tracking-wide text-slate-800">
                {s.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{s.desc}</p>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex items-center justify-center self-center py-1 text-slate-300 lg:py-0">
                <ArrowRight className="h-4 w-4 -rotate-90 lg:rotate-0" />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}