import { useMemo, useRef, useState } from "react";
import type { Finding, Report } from "../types";
import { pollJob, uploadCompare, pageUrl } from "../api";
import AssessmentCard from "../components/AssessmentCard";
import PageViewer from "../components/PageViewer";
import FindingList from "../components/FindingList";
import FileDropzone from "../components/FileDropzone";
import { TemplateIcon } from "../components/icons";

type Phase = "idle" | "uploading" | "processing" | "done" | "error";

interface DiffStats {
  shifts: number;
  fonts: number;
  missing: number;
  extra: number;
}

function diffStats(findings: Finding[]): DiffStats {
  const refs = findings.filter((f) => f.category === "reference");
  return {
    shifts: refs.filter((f) => f.id.startsWith("refpos")).length,
    fonts: refs.filter((f) => f.id.startsWith("reffont")).length,
    missing: refs.filter((f) => f.id.startsWith("refmiss")).length,
    extra: refs.filter((f) => f.id.startsWith("refextra")).length,
  };
}

export default function TemplatesPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [tplFile, setTplFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [findingPage, setFindingPage] = useState(1);
  const [blinkSignal, setBlinkSignal] = useState<{ id: string; n: number } | null>(null);
  const blinkCounter = useRef(0);

  const run = async () => {
    if (!docFile || !tplFile) return;
    setError(null);
    setPhase("uploading");
    setActiveId(null);
    setFindingPage(1);
    setBlinkSignal(null);
    try {
      const { job_id } = await uploadCompare(docFile, tplFile);
      setJobId(job_id);
      setPhase("processing");
      const done = await pollJob(job_id);
      if (done.status === "complete" && done.report) {
        setReport(done.report);
        setPhase("done");
      } else {
        setError(done.error ?? "Comparison failed");
        setPhase("error");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed");
      setPhase("error");
    }
  };

  const selectFinding = (f: Finding, fromViewer = false) => {
    setActiveId(f.id);
    const serial = serialById[f.id] ?? 0;
    if (serial > 0) {
      const target = Math.ceil(serial / 5);
      if (target !== findingPage) setFindingPage(target);
    }
    if (fromViewer) {
      blinkCounter.current += 1;
      setBlinkSignal({ id: f.id, n: blinkCounter.current });
    }
  };

  const reset = () => {
    setDocFile(null);
    setTplFile(null);
    setReport(null);
    setJobId(null);
    setActiveId(null);
    setFindingPage(1);
    setBlinkSignal(null);
    setError(null);
    setPhase("idle");
  };

  const stats = report ? diffStats(report.findings) : null;
  const ref = report?.reference;

  const orderedFindings = useMemo(
    () =>
      report
        ? [...report.findings].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
        : [],
    [report]
  );
  const serialById = useMemo(() => {
    const m: Record<string, number> = {};
    orderedFindings.forEach((f, i) => (m[f.id] = i + 1));
    return m;
  }, [orderedFindings]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <TemplateIcon className="w-6 h-6" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Reference Template Comparison
          </h1>
          <p className="text-sm text-slate-500">
            Verify a document against an official template and get a highlighted difference report.
          </p>
        </div>
      </div>

      {phase === "idle" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 max-w-xl mx-auto text-center">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Compare against a template</h2>
          <p className="text-sm text-slate-500 mb-6">
            Upload the document to verify and the official reference template. The pipeline aligns
            both and flags blocks that moved, changed font, went missing or were added.
          </p>
          <div className="space-y-3 text-left">
            <FileDropzone file={tplFile} onSelect={setTplFile} onRemove={() => setTplFile(null)} label="Official template *" accent />
            <FileDropzone file={docFile} onSelect={setDocFile} onRemove={() => setDocFile(null)} label="Document to verify *" />
            <button
              disabled={!docFile || !tplFile}
              onClick={run}
              className="w-full px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Compare document against template
            </button>
          </div>
        </div>
      )}

      {(phase === "uploading" || phase === "processing") && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center max-w-xl mx-auto">
          <div className="mx-auto w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-4" />
          <h2 className="text-lg font-semibold text-slate-800">
            {phase === "uploading" ? "Uploading…" : "Comparing document to template…"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {docFile?.name} vs {tplFile?.name}
          </p>
        </div>
      )}

      {phase === "error" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center max-w-xl mx-auto">
          <h2 className="text-lg font-semibold text-red-600 mb-2">Comparison failed</h2>
          <p className="text-sm text-slate-600">{error}</p>
          <button
            onClick={() => setPhase("idle")}
            className="mt-4 px-5 py-2 bg-slate-900 text-white rounded-lg text-sm"
          >
            Try again
          </button>
        </div>
      )}

      {phase === "done" && report && stats && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Difference report</h2>
              <p className="text-sm text-slate-500">
                Template: <span className="font-mono text-indigo-600">{ref?.template ?? "—"}</span>
              </p>
            </div>
            <button
              onClick={reset}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
            >
              New comparison
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-2xl font-bold text-slate-900">{stats.shifts}</div>
              <div className="text-xs font-medium text-slate-500">Position shifts</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-2xl font-bold text-slate-900">{stats.fonts}</div>
              <div className="text-xs font-medium text-slate-500">Font differences</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-2xl font-bold text-slate-900">{stats.missing}</div>
              <div className="text-xs font-medium text-slate-500">Missing blocks</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-2xl font-bold text-slate-900">{stats.extra}</div>
              <div className="text-xs font-medium text-slate-500">Extra blocks</div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showOverlay}
              onChange={(e) => setShowOverlay(e.target.checked)}
              className="accent-indigo-600"
            />
            Show difference overlays on rendered page
          </label>

          <AssessmentCard assessment={report.assessment} />

          <div className="grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-6">
              {report.pages.map((p) => (
                <PageViewer
                  key={p.index}
                  jobId={jobId!}
                  page={p}
                  findings={showOverlay ? report.findings : []}
                  activeFindingId={activeId}
                  onSelect={(f) => selectFinding(f, true)}
                  serialById={serialById}
                  blinkSignal={blinkSignal}
                />
              ))}
              {report.pages.length === 0 && jobId && (
                <div className="bg-white rounded-lg shadow p-6 text-center text-sm text-slate-500">
                  No rendered preview available.{" "}
                  <img
                    src={pageUrl(jobId ?? "", "page_0.png")}
                    alt="page preview"
                    className="mx-auto mt-4 max-w-full rounded border border-slate-200"
                  />
                </div>
              )}
            </div>
            <div className="lg:col-span-2">
              <div className="sticky top-6 space-y-4">
                <FindingList
                  findings={report.findings}
                  activeId={activeId}
                  onSelect={(f) => selectFinding(f)}
                  page={findingPage}
                  onPageChange={setFindingPage}
                  serialById={serialById}
                  blinkSignal={blinkSignal}
                />
                <div id="findings-detail" className="bg-white rounded-lg shadow p-5">
                  {report.findings.map((f) =>
                    f.id === activeId ? (
                      <div key={f.id}>
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide capitalize">
                          #{serialById[f.id] ?? ""} {f.category} · {f.module.replace("_", " ")}
                        </h3>
                        <p className="mt-1 text-sm capitalize text-slate-600">
                          Severity: <span className="font-semibold">{f.severity}</span> · score{" "}
                          {f.score.toFixed(2)}
                        </p>
                        <p className="mt-2 text-sm text-slate-700">{f.explanation}</p>
                        {f.evidence.length > 0 && (
                          <ul className="mt-3 space-y-1">
                            {f.evidence.map((e, i) => (
                              <li
                                key={i}
                                className="text-xs text-slate-500 border-l-2 border-slate-200 pl-2"
                              >
                                {e}
                              </li>
                            ))}
                          </ul>
                        )}
                        {f.region && (
                          <p className="mt-3 text-xs text-slate-400">
                            Location: page {f.region.page + 1}, x {Math.round(f.region.x)} y{" "}
                            {Math.round(f.region.y)} {Math.round(f.region.w)}×
                            {Math.round(f.region.h)}
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
  );
}