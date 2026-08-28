import { useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { HistoryItem } from "../types";
import { useApp } from "../AppContext";
import { colors, font, radius, spacing } from "../theme";
import { Card, Section, Tx } from "../components/Ui";
import { ReportDetail } from "../components/ReportDetail";
import { formatDate, riskTone } from "../utils";

export function HistoryScreen({ active }: { active: boolean }) {
  const { history } = useApp();
  const [selected, setSelected] = useState<HistoryItem | null>(null);

  if (selected) {
    return <ReportDetail item={selected} onBack={() => setSelected(null)} active={active} />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section
        kicker="Activity"
        title="Verification history"
        description="Every document you verify is recorded here with its score, risk level and findings."
      />
      {history.length === 0 ? (
        <Card>
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={30} color={colors.slate300} />
            <Tx size={font.sm} color={colors.slate500} style={{ textAlign: "center", marginTop: spacing.sm }}>
              No verifications yet — run your first one on the Verify tab.
            </Tx>
          </View>
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {history.map((r) => {
            const tone = riskTone(r.risk);
            return (
              <TouchableOpacity key={r.jobId} onPress={() => setSelected(r)}>
                <Card padded={false} style={styles.row}>
                  <Ionicons name="document-attach" size={18} color={colors.indigo500} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Tx size={font.sm} weight="600" color={colors.slate800} numberOfLines={1}>
                      {r.filename}
                    </Tx>
                    <Tx size={font.xs} color={colors.slate400}>
                      {formatDate(r.createdAt)}
                    </Tx>
                  </View>
                  {r.template ? (
                    <Ionicons name="git-compare-outline" size={15} color={colors.indigo400} />
                  ) : null}
                  {r.status === "failed" ? (
                    <View style={[styles.riskPill, { backgroundColor: colors.red100 }]}>
                      <Tx size={font.xxs} weight="700" color={colors.red700}>
                        FAILED
                      </Tx>
                    </View>
                  ) : (
                    <View style={[styles.riskPill, { backgroundColor: tone.bg }]}>
                      <Tx size={font.xxs} weight="700" color={tone.fg}>
                        {r.risk ?? "—"}
                      </Tx>
                    </View>
                  )}
                  {r.score != null ? (
                    <Tx size={font.sm} weight="700" color={colors.slate800}>
                      {Math.round(r.score)}
                    </Tx>
                  ) : null}
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.slate50,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  riskPill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  empty: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
});