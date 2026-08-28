import { useState } from "react";
import AnalysisCategories from "./AnalysisCategories";
import HeroSection from "./HeroSection";
import HowItWorks from "./HowItWorks";
import RecentVerifications from "./RecentVerifications";
import SampleReportModal from "./SampleReportModal";
import TrustBanner from "./TrustBanner";

export default function Dashboard({
  onVerify,
  onOpenHistory,
  onOpenJob,
}: {
  onVerify: () => void;
  onOpenHistory: () => void;
  onOpenJob: (id: string) => void;
}) {
  const [sampleOpen, setSampleOpen] = useState(false);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <HeroSection onVerify={onVerify} onViewSample={() => setSampleOpen(true)} />

      <div className="mt-12 space-y-12">
        <HowItWorks />
        <AnalysisCategories />
        <RecentVerifications onViewAll={onOpenHistory} onOpen={onOpenJob} />
        <TrustBanner />
      </div>

      <footer className="mt-12 flex flex-col items-center gap-1 border-t border-slate-200 pt-6 text-center">
        <span className="text-xs font-semibold text-slate-600">
          DocuVerify · Intelligent Document Authenticity &amp; Forgery Detection
        </span>
        <span className="text-[11px] text-slate-400">
          Evidence-based forensic analysis to support human verification.
        </span>
      </footer>

      <SampleReportModal open={sampleOpen} onClose={() => setSampleOpen(false)} />
    </main>
  );
}