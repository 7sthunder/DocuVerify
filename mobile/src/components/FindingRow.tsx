import { StyleSheet, TouchableOpacity, View } from "react-native";
import type { Finding } from "../types";
import { colors, font, radius, spacing } from "../theme";
import { Tx } from "./Ui";

const SEV_DOT: Record<string, string> = {
  high: colors.red500,
  medium: colors.amber400,
  low: "#eab308",
};

export function FindingRow({
  finding,
  isActive,
  onPress,
}: {
  finding: Finding;
  isActive: boolean;
  onPress: () => void;
}) {
  const f = finding;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.row,
        isActive ? { borderColor: colors.slate800, backgroundColor: colors.slate50 } : null,
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.dot, { backgroundColor: SEV_DOT[f.severity] }]} />
        <Tx size={font.sm} weight="600" color={colors.slate800} style={{ textTransform: "capitalize" }}>
          {f.category.replace("_", " ")}
        </Tx>
        <Tx size={font.xxs} color={colors.slate400} style={{ textTransform: "uppercase", flexShrink: 1 }} numberOfLines={1}>
          {f.module}
        </Tx>
        <Tx size={font.xs} weight="700" color={colors.slate500} style={{ marginLeft: "auto" }}>
          {Math.round(f.score * 100)}
        </Tx>
      </View>
      <Tx size={font.xs} color={colors.slate600} numberOfLines={2} style={{ marginTop: 2, lineHeight: 17 }}>
        {f.explanation}
      </Tx>
      {f.region ? (
        <Tx size={font.xxs} color={colors.slate400} style={{ marginTop: 2 }}>
          Page {f.region.page + 1} @ ({Math.round(f.region.x)}, {Math.round(f.region.y)})
        </Tx>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
    backgroundColor: colors.white,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});