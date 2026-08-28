import { colors } from "./theme";

export function formatDate(ts: number): string {
  const d = new Date(ts);
  try {
    return d.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d.toISOString();
  }
}

export function riskTone(risk: string | null): { bg: string; fg: string } {
  if (risk === "HIGH") return { bg: colors.red100, fg: colors.red700 };
  if (risk === "MEDIUM") return { bg: colors.amber100, fg: colors.amber700 };
  return { bg: colors.emerald100, fg: colors.emerald700 };
}