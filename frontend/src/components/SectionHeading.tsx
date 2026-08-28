interface SectionHeadingProps {
  kicker?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}

export default function SectionHeading({
  kicker,
  title,
  description,
  align = "left",
}: SectionHeadingProps) {
  const alignClass = align === "center" ? "items-center text-center" : "items-start";
  return (
    <div className={`flex flex-col ${alignClass}`}>
      {kicker && (
        <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
          {kicker}
        </span>
      )}
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
      {description && (
        <p className={`mt-2 text-sm text-slate-500 max-w-lg ${align === "center" ? "mx-auto" : ""}`}>
          {description}
        </p>
      )}
    </div>
  );
}