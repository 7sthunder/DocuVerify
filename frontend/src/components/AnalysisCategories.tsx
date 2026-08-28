import type { ReactNode } from "react";
import {
  ImageIcon,
  InfoIcon,
  LinkIcon,
  LayoutIcon,
  TypeIcon,
  type IconProps,
} from "./icons";
import SectionHeading from "./SectionHeading";

const CATEGORIES: { title: string; desc: string; icon: (p: IconProps) => ReactNode }[] = [
  {
    title: "Document Structure",
    desc: "Layout, alignment, spacing and position analysis",
    icon: (p) => <LayoutIcon {...p} />,
  },
  {
    title: "Typography",
    desc: "Font type, size, style and consistency checks",
    icon: (p) => <TypeIcon {...p} />,
  },
  {
    title: "Visual Elements",
    desc: "Logos, seals, signatures and image analysis",
    icon: (p) => <ImageIcon {...p} />,
  },
  {
    title: "Metadata",
    desc: "File properties and creation information",
    icon: (p) => <InfoIcon {...p} />,
  },
  {
    title: "Content Consistency",
    desc: "Text relationships and logical consistency",
    icon: (p) => <LinkIcon {...p} />,
  },
];

export default function AnalysisCategories() {
  return (
    <section>
      <SectionHeading
        kicker="Forensic layers"
        title="What we analyze"
        description="DocuVerify combines multiple independent forensic signals rather than relying on a single model output."
      />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {CATEGORIES.map((c) => (
          <div
            key={c.title}
            className="relative rounded-2xl border border-slate-200 bg-white p-5 pt-6 shadow-sm"
          >
            <span className="absolute inset-x-5 top-0 h-[3px] rounded-b bg-indigo-500" />
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              {c.icon({ className: "w-5 h-5" })}
            </span>
            <h3 className="mt-3 text-sm font-bold uppercase tracking-wide text-slate-800">
              {c.title}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{c.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}