import { InfoIcon } from "./icons";

export default function TrustBanner() {
  return (
    <section className="flex gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm">
        <InfoIcon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm leading-relaxed text-slate-700">
          Our system does not provide absolute proof of authenticity. It provides an
          evidence-based assessment to assist human verification.
        </p>
      </div>
    </section>
  );
}