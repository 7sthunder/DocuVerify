import type { ReactNode } from "react";
import { ArrowRight } from "./icons";

interface PlaceholderPageProps {
  icon: ReactNode;
  title: string;
  description: string;
  note?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function PlaceholderPage({
  icon,
  title,
  description,
  note,
  actionLabel,
  onAction,
}: PlaceholderPageProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-16 sm:py-20 text-center">
        <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600">
          {icon}
        </div>
        <h2 className="mt-5 text-xl font-bold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-2 max-w-md mx-auto text-sm text-slate-500">{description}</p>
        {note && (
          <p className="mt-4 mx-auto max-w-md text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            {note}
          </p>
        )}
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            {actionLabel}
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}