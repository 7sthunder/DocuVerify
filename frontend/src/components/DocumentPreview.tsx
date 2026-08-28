import { LogoIcon } from "./icons";

function Highlight({
  children,
  marker,
  tone,
}: {
  children: React.ReactNode;
  marker: number;
  tone: "red" | "amber";
}) {
  const toneClass =
    tone === "red"
      ? "border-red-400 bg-red-100/40 text-red-700"
      : "border-amber-400 bg-amber-100/40 text-amber-700";
  const dot = tone === "red" ? "bg-red-500" : "bg-amber-500";
  return (
    <span className="relative inline-block font-semibold">
      <span className={`absolute -inset-1 rounded border-2 border-dashed ${toneClass}`} />
      <span
        className={`absolute -top-2 -left-2 z-10 flex h-5 w-5 items-center justify-center rounded-full ${dot} text-[10px] font-bold text-white shadow-sm`}
      >
        {marker}
      </span>
      <span className="relative">{children}</span>
    </span>
  );
}

export default function DocumentPreview({ className }: { className?: string }) {
  return (
    <div
      className={`relative w-[260px] sm:w-[280px] rounded-lg border border-slate-200 bg-white p-5 shadow-md rotate-[0.6deg] ${className ?? ""}`}
    >
      <div className="pointer-events-none absolute inset-2 rounded-md border border-slate-100" />

      <div className="relative z-10 text-center">
        <div className="flex items-center justify-center gap-1.5 text-indigo-600">
          <LogoIcon className="w-4 h-4" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-700">
            Certificate
          </span>
        </div>

        <p className="mt-4 text-[12px] text-slate-400">This is to certify that</p>

        <div className="mt-1.5 flex justify-center">
          <Highlight marker={1} tone="red">
            <span className="font-serif text-xl text-slate-800">John Doe</span>
          </Highlight>
        </div>

        <p className="mt-4 text-[11px] text-slate-400">has successfully completed</p>
        <p className="mt-1 text-[13px] font-semibold text-slate-700">
          Bachelor of Computer Science
        </p>

        <div className="mx-auto mt-4 h-px w-3/4 bg-slate-200" />

        <div className="mt-4 space-y-1.5 text-[12px]">
          <div className="flex items-center justify-center gap-2">
            <span className="text-slate-400">CGPA</span>
            <Highlight marker={2} tone="red">
              <span className="text-slate-800">8.75</span>
            </Highlight>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-slate-400">Date</span>
            <Highlight marker={3} tone="amber">
              <span className="text-slate-800">15 May 2026</span>
            </Highlight>
          </div>
        </div>

        <p className="mt-4 text-[9px] uppercase tracking-[0.25em] text-slate-300">
          Demo document · fictional content
        </p>
      </div>
    </div>
  );
}