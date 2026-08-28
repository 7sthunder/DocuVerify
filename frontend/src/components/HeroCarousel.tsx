import { useEffect, useState } from "react";
import AnalysisSummaryCard from "./AnalysisSummaryCard";
import DocumentPreview from "./DocumentPreview";

const INTERVAL_MS = 3000;

const SLIDES = [
  { key: "document", label: "Document", content: <DocumentPreview /> },
  { key: "findings", label: "Findings", content: <AnalysisSummaryCard /> },
];

export default function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div
      className="flex flex-col items-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto mb-5 flex w-fit items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
        {SLIDES.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setIndex(i)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors duration-300 ${
              i === index ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="relative h-[360px] w-[280px] sm:w-[300px]">
        <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-gradient-to-br from-indigo-200/50 via-white to-amber-100/60 blur-2xl" />

        {SLIDES.map((s, i) => {
          const active = i === index;
          return (
            <div
              key={s.key}
              aria-hidden={!active}
              className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ease-in-out ${
                active
                  ? "z-20 translate-x-0 scale-100 opacity-100"
                  : "z-10 scale-95 opacity-0"
              }`}
            >
              {s.content}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setIndex(i)}
            aria-label={`Show ${s.label} slide`}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === index ? "w-6 bg-indigo-600" : "w-1.5 bg-slate-300 hover:bg-slate-400"
            }`}
          />
        ))}
      </div>
    </div>
  );
}