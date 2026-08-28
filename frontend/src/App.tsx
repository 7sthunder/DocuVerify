import { useRef, useState } from "react";
import type { Finding, JobStatus } from "./types";
import { pageUrl, pollJob, uploadCompare, uploadDocument } from "./api";
import AssessmentCard from "./components/AssessmentCard";
import PageViewer from "./components/PageViewer";
import FindingList from "./components/FindingList";

type Phase = "idle" | "uploading" | "processing" | "done" | "error";

export default function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const docRef = useRef<HTMLInputElement>(null);
  const tplRef = useRef<HTMLInputElement>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [tplFile, setTplFile] = useState<File | null>(null);

  const run = async (doc: File, tpl: File | null) => {
    setError(null);
    setPhase("uploading");
    setFilename(doc.name);
    setActiveId(null);
    try {
      const { job_id } = tpl
        ? await uploadCompare(doc, tpl)
        : await uploadDocument(doc);
      setJobId(job_id);
      setPhase("processing");
      const done = await pollJob(job_id, (j) => {
        setJob(j);
        if (j.status === "complete") setPhase("done");
        if (j.status === "failed") {
          setError(j.error ?? "Analysis failed");
          setPhase("error");
        }
      });
      setJob(done);
      if (done.status === "complete") setPhase("done");
      else {
        setError(done.error ?? "Analysis failed");
        setPhase("error");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setPhase("error");
    }
  };

  const selectFinding = (f: Finding) => {
    setActiveId(f.id);
    const el = document.getElementById(f.id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const reset = () => {
    setDocFile(null);
    setTplFile(null);
    setJob(null);
    setJobId(null);
    setActiveId(null);
    setError(null);
    setPhase("idle");
  };

  const report = job?.report;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">DocuVerify</h1>
            <p className="text-xs text-slate-500">Intelligent Document Authenticity &amp; Forgery Detection</p>
          </div>
          {jobId && report && (
            <img
              src={pageUrl(jobId, report.pages[0].image)}
              alt="uploaded"
              className="hidden sm:block h-10 w-auto border rounded"
            />
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {phase === "idle" && (
          <div className="bg-white rounded-lg shadow p-10 max-w-xl mx-auto text-center">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Verify a document</h2>
            <p className="text-sm text-slate-500 mb-6">
              Upload a PDF, JPG or PNG. DocuVerify extracts text, layout, typography, visual and metadata signals and
              produces an explainable forensic assessment with highlighted suspicious regions.
            </p>
            <div className="space-y-3 text-left">
              <div className="border rounded-lg p-4">
                <label className="text-sm font-medium text-slate-700">Document to verify *</label>
                <button
                  onClick={() => docRef.current?.click()}
                  className="mt-2 w-full px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-700"
                >
                  {docFile ? `✓ ${docFile.name}` : "Choose document"}
                </button>
                <input
                  ref={docRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="border rounded-lg p-4">
                <label className="text-sm font-medium text-slate-700">
                  Official template <span className="text-slate-400">(optional — enables reference comparison)</span>
                </label>
                <button
                  onClick={() => tplRef.current?.click()}
                  className="mt-2 w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                >
                  {tplFile ? `✓ ${tplFile.name}` : "Choose template"}
                </button>
                {tplFile && (
                  <button
                    onClick={() => setTplFile(null)}
                    className="mt-1 text-xs text-red-500 hover:underline"
                  >
                    Remove template
                  </button>
                )}
                <input
                  ref={tplRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => setTplFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <button
                disabled={!docFile}
                onClick={() => docFile && run(docFile, tplFile)}
                className="w-full px-6 py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {tplFile ? "Analyze against template" : "Analyze document"}
              </button>
            </div>
          </div>
        )}

        {(phase === "uploading" || phase === "processing") && (
          <div className="bg-white rounded-lg shadow p-10 text-center">
            <div className="mx-auto w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-4" />
            <h2 className="text-lg font-semibold text-slate-800">
              {phase === "uploading" ? "Uploading…" : "Analyzing document…"}
            </h2>
            <p className="text-sm text-slate-500 mt-1">{filename}</p>
            <p className="text-xs text-slate-400 mt-2">OCR, layout, typography, visual, metadata &amp; semantic checks</p>
          </div>
        )}

        {phase === "error" && (
          <div className="bg-white rounded-lg shadow p-10 text-center">
            <h2 className="text-lg font-semibold text-red-600 mb-2">Analysis failed</h2>
            <p className="text-sm text-slate-600">{error}</p>
            <button
              onClick={() => setPhase("idle")}
              className="mt-4 px-5 py-2 bg-slate-900 text-white rounded-lg text-sm"
            >
              Try another document
            </button>
          </div>
        )}

        {phase === "done" && job && report && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={showOverlay}
                    onChange={(e) => setShowOverlay(e.target.checked)}
                    className="accent-slate-900"
                  />
                  Show region overlays
                </label>
              </div>
              <button
                onClick={reset}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
              >
                New document
              </button>
            </div>

            {report.reference?.enabled && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-sm text-indigo-800">
                <b>Reference comparison:</b> document checked against official template{" "}
                <span className="font-mono">{report.reference.template}</span> —{" "}
                {report.reference.finding_count} template-difference finding(s).
              </div>
            )}

            <AssessmentCard assessment={report.assessment} />

            {report.llm?.summary && (
              <div className="bg-white rounded-lg shadow p-5 border-l-4 border-indigo-400">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    AI semantic assessment
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    {report.llm.finding_count} LLM findings
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700 leading-relaxed">{report.llm.summary}</p>
              </div>
            )}
            {report.llm?.error && report.llm.enabled && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-700">
                LLM layer note: {report.llm.error}. Deterministic analyzers still produced the full report.
              </div>
            )}

            <div className="grid lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 space-y-6">
                {report.pages.map((p) => (
                  <PageViewer
                    key={p.index}
                    jobId={jobId!}
                    page={p}
                    findings={showOverlay ? report.findings : []}
                    activeFindingId={activeId}
                    onSelect={(f) => selectFinding(f)}
                  />
                ))}
              </div>
              <div className="lg:col-span-2">
                <div id="finding-list" className="sticky top-6 space-y-4">
                  <FindingList
                    findings={report.findings}
                    activeId={activeId}
                    onSelect={(f) => selectFinding(f)}
                  />
                  <div id={activeId ?? "panel"} className="bg-white rounded-lg shadow p-5">
                    {report.findings.map((f) =>
                      f.id === activeId ? (
                        <div key={f.id}>
                          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                            {f.category.replace("_", " ")} anomaly
                          </h3>
                          <p className="mt-1 text-sm capitalize text-slate-600">
                            Severity: <span className="font-semibold">{f.severity}</span> · module: {f.module}
                          </p>
                          <p className="mt-2 text-sm text-slate-700">{f.explanation}</p>
                          {f.evidence.length > 0 && (
                            <ul className="mt-3 space-y-1">
                              {f.evidence.map((e, i) => (
                                <li key={i} className="text-xs text-slate-500 border-l-2 border-slate-200 pl-2">
                                  {e}
                                </li>
                              ))}
                            </ul>
                          )}
                          {f.region && (
                            <p className="mt-3 text-xs text-slate-400">
                              Location: page {f.region.page + 1}, x {Math.round(f.region.x)} y {Math.round(f.region.y)}{" "}
                              {Math.round(f.region.w)}×{Math.round(f.region.h)}
                            </p>
                          )}
                        </div>
                      ) : null
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {report.assessment.disclaimer}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}