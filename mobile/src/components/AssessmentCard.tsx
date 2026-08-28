import { StyleSheet, View } from "react-native";
import type { Assessment, CategoryStatus } from "../types";
import { colors, font, radius, spacing } from "../theme";
import { Card, Tx } from "./Ui";

export const RISK_STYLES: Record<string, { bg: string; fg: string }> = {
  LOW: { bg: colors.emerald100, fg: colors.emerald700 },
  MEDIUM: { bg: colors.amber100, fg: colors.amber700 },
  HIGH: { bg: colors.red100, fg: colors.red700 },
};

export function RiskBadge({ level }: { level: string }) {
  const s = RISK_STYLES[level] ?? RISK_STYLES.LOW;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Tx size={font.sm} weight="700" color={s.fg}>
        {level} SUSPICION
      </Tx>
    </View>
  );
}

export function ScoreBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const barColor = pct < 30 ? colors.emerald500 : pct < 65 ? colors.amber500 : colors.red500;
  return (
    <View style={styles.scoreBlock}>
      <View style={styles.scoreRow}>
        <Tx size={font.xxl} weight="700" color={colors.slate900}>
          {value.toFixed(1)}
        </Tx>
        <Tx size={font.sm} color={colors.slate500}>
          / 100
        </Tx>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

const CATEGORY_ORDER = ["typography", "layout", "visual", "semantic", "text_layer", "metadata"];

function sevDot(sev: string | null): string {
  if (sev === "high") return colors.red500;
  if (sev === "medium") return colors.amber400;
  if (sev === "low") return "#eab308";
  return colors.slate300;
}

export function AssessmentCard({ assessment }: { assessment: Assessment }) {
  const cats = [...assessment.categories].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
  );
  return (
    <Card>
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Tx size={font.md} weight="700" color={colors.slate800}>
            Authenticity Assessment
          </Tx>
          <Tx size={font.sm} color={colors.slate500}>
            Evidence-based suspicion score
          </Tx>
        </View>
        <RiskBadge level={assessment.risk_level} />
      </View>

      <ScoreBar value={assessment.suspicion_score} />

      <View style={styles.grid}>
        {cats.map((c) => (
          <CategoryCell key={c.category} c={c} />
        ))}
      </View>
    </Card>
  );
}

function CategoryCell({ c }: { c: CategoryStatus }) {
  return (
    <View style={styles.cat}>
      <View style={styles.catLabelRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1 }}>
          <View
            style={[styles.catDot, { backgroundColor: c.available && c.max_severity ? sevDot(c.max_severity) : colors.slate300 }]}
          />
          <Tx size={font.xs} weight="500" color={colors.slate600} numberOfLines={1}>
            {c.category.replace("_", " ")}
          </Tx>
        </View>
      </View>
      <Tx size={font.sm} weight="700" color={colors.slate800} style={{ textTransform: "capitalize" }}>
        {c.available ? c.label : "n/a"}
      </Tx>
      {c.available ? (
        <Tx size={font.xxs} color={colors.slate400}>
          {(c.score * 100).toFixed(1)}% contribution
        </Tx>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  scoreBlock: {
    marginTop: spacing.lg,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  track: {
    marginTop: spacing.sm,
    height: 12,
    borderRadius: radius.full,
    backgroundColor: colors.slate100,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.full,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  grid: {
    marginTop: spacing.lg,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  cat: {
    flexBasis: "30%",
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    gap: 1,
  },
  catLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  catDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});