import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Finding } from "../types";
import { colors, font, radius, spacing } from "../theme";
import { Chip, Tx } from "./Ui";

const SEV_COLOR: Record<string, string> = {
  high: colors.red500,
  medium: colors.amber400,
  low: "#eab308",
};

export function FindingDetailModal({
  finding,
  onClose,
}: {
  finding: Finding | null;
  onClose: () => void;
}) {
  const f = finding;
  return (
    <Modal
      visible={!!f}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropFiller} onPress={onClose} />
        <View style={styles.sheet}>
          {f ? (
            <>
              <View style={styles.grabber} />
              <View style={styles.headRow}>
                <View style={styles.titleBlock}>
                  <Tx size={font.lg} weight="700" color={colors.slate900} style={{ textTransform: "capitalize" }}>
                    {f.category.replace("_", " ")} anomaly
                  </Tx>
                  <Tx size={font.xs} color={colors.slate500}>
                    module: {f.module}
                  </Tx>
                </View>
                <View style={[styles.sevDot, { backgroundColor: SEV_COLOR[f.severity] }]} />
              </View>

              <ScrollView style={{ flexGrow: 0 }} bounces={false}>
                <View style={styles.chipRow}>
                  <Chip label={f.severity.toUpperCase()} bg={colors.slate100} fg={colors.slate700} />
                  <Chip label={`score ${Math.round(f.score * 100)}`} bg={colors.slate100} fg={colors.slate700} />
                  <Chip label={`confidence ${Math.round(f.confidence * 100)}%`} bg={colors.slate100} fg={colors.slate700} />
                </View>

                <Tx size={font.sm} color={colors.slate700} style={{ lineHeight: 21, marginTop: spacing.md }}>
                  {f.explanation}
                </Tx>

                {f.evidence.length > 0 ? (
                  <View style={{ marginTop: spacing.lg }}>
                    <Tx size={font.xs} weight="700" color={colors.slate500} style={{ textTransform: "uppercase" }}>
                      Evidence
                    </Tx>
                    {f.evidence.map((e, i) => (
                      <View key={i} style={styles.evidence}>
                        <View style={styles.evidenceBar} />
                        <Tx size={font.xs} color={colors.slate500} style={{ flex: 1, lineHeight: 18 }}>
                          {e}
                        </Tx>
                      </View>
                    ))}
                  </View>
                ) : null}

                {f.region ? (
                  <Tx size={font.xs} color={colors.slate400} style={{ marginTop: spacing.lg }}>
                    Location: page {f.region.page + 1}, x {Math.round(f.region.x)} y {Math.round(f.region.y)} ·{" "}
                    {Math.round(f.region.w)}×{Math.round(f.region.h)}
                  </Tx>
                ) : null}
              </ScrollView>

              <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.slate500} />
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  backdropFiller: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    maxHeight: "75%",
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.slate200,
    marginBottom: spacing.lg,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingRight: spacing.xl,
  },
  titleBlock: {
    flex: 1,
    gap: 1,
  },
  sevDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 6,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  evidence: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  evidenceBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.slate200,
  },
  closeBtn: {
    position: "absolute",
    top: spacing.xl,
    right: spacing.xl,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.slate100,
    alignItems: "center",
    justifyContent: "center",
  },
});