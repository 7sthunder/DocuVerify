import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import type { Finding, PageInfo } from "../types";
import { pageImageUrl } from "../api";
import { colors, font, radius, shadow, spacing } from "../theme";
import { Tx } from "./Ui";

const SEVERITY_STYLE: Record<string, { border: string; fill: string; label: string; text: string }> = {
  high: { border: colors.red500, fill: "rgba(239,68,68,0.25)", label: "High suspicion", text: colors.red700 },
  medium: { border: colors.amber400, fill: "rgba(251,191,36,0.25)", label: "Medium suspicion", text: colors.amber600 },
  low: { border: "#eab308", fill: "rgba(234,179,8,0.25)", label: "Low suspicion", text: "#ca8a04" },
};

export function PageViewer({
  jobId,
  page,
  findings,
  activeFindingId,
  onSelect,
  active,
}: {
  jobId: string;
  page: PageInfo;
  findings: Finding[];
  activeFindingId: string | null;
  onSelect: (f: Finding) => void;
  active: boolean;
}) {
  const onPage = findings.filter((f) => f.region && f.region.page === page.index);
  if (!active) return null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Tx size={font.md} weight="600" color={colors.slate800}>
          Page {page.index + 1}
        </Tx>
        <View style={styles.legend}>
          {[
            { color: colors.red500, label: "High" },
            { color: colors.amber400, label: "Medium" },
            { color: "#eab308", label: "Low" },
          ].map((l) => (
            <View key={l.label} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: l.color }]} />
              <Tx size={font.xxs} color={colors.slate500}>
                {l.label}
              </Tx>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.page, { aspectRatio: `${page.width} / ${page.height}` }]}>
        <Image
          source={{ uri: pageImageUrl(jobId, page.image) }}
          style={styles.img}
          resizeMode="contain"
        />
        {onPage.map((f) => {
          const r = f.region!;
          const style = SEVERITY_STYLE[f.severity];
          const isActive = f.id === activeFindingId;
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => onSelect(f)}
              style={[
                styles.region,
                {
                  left: `${(r.x / page.width) * 100}%`,
                  top: `${(r.y / page.height) * 100}%`,
                  width: `${(r.w / page.width) * 100}%`,
                  height: `${(r.h / page.height) * 100}%`,
                  borderColor: style.border,
                  backgroundColor: isActive ? "transparent" : style.fill,
                  borderWidth: isActive ? 3 : 2,
                  zIndex: isActive ? 10 : 1,
                },
              ]}
            >
              {isActive ? (
                <View style={[styles.regionLabel, { backgroundColor: style.border }]}>
                  <Tx size={font.xxs} weight="700" color={colors.white}>
                    {f.category.replace("_", " ").toUpperCase()} · {style.label.toUpperCase()}
                  </Tx>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  page: {
    width: "100%",
    backgroundColor: colors.slate100,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.slate200,
    position: "relative",
  },
  img: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  region: {
    position: "absolute",
    borderRadius: 2,
  },
  regionLabel: {
    position: "absolute",
    top: -20,
    left: 0,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
});