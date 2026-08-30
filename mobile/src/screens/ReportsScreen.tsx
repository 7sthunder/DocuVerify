import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { HistoryItem, JobSummary } from "../types";
import { listJobs } from "../api";
import { colors, font, radius, spacing } from "../theme";
import { Card, Section, Tx } from "../components/Ui";
import { ReportDetail } from "../components/ReportDetail";
import { RiskBadge } from "../components/AssessmentCard";
import { formatDate, riskTone } from "../utils";

function toHistoryItem(j: JobSummary): HistoryItem {
  return {
    jobId: j.id,
    filename: j.filename,
    createdAt: j.created,
    score: j.score,
    risk: j.risk_level,
    template: null,
    status: j.status === "completed" ? "complete" : "failed",
    error: null,
    report: null,
  };
}

export function ReportsScreen({ active }: { active: boolean }) {
  const [reports, setReports] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HistoryItem | null>(null);

  useEffect(() => {
    let alive = true;
    listJobs()
      .then((rows) => {
        if (alive) {
          const items = rows
            .filter((r) => r.status === "completed")
            .map(toHistoryItem);
          setReports(items);
        }
      })
      .catch(() => { if (alive) { setReports([]); } })
      .finally(() => { if (alive) { setLoading(false); } });
    return () => { alive = false; };
  }, []);

  if (selected) {
    return <ReportDetail item={selected} onBack={() => setSelected(null)} active={active} />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section
        kicker="Archive"
        title="Forensic reports"
        description="A full forensic report is stored for every completed verification — suspicion score, findings and region overlays."
      />

      {loading ? (
        <Card>
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={30} color={colors.slate300} />
            <Tx size={font.sm} color={colors.slate500} style={{ textAlign: "center", marginTop: spacing.sm }}>
              Loading reports…
            </Tx>
          </View>
        </Card>
      ) : reports.length === 0 ? (
        <Card>
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={30} color={colors.slate300} />
            <Tx size={font.sm} color={colors.slate500} style={{ textAlign: "center", marginTop: spacing.sm }}>
              Completed verifications will appear here as saved forensic reports.
            </Tx>
          </View>
        </Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          {reports.map((r) => {
            const tone = riskTone(r.risk);
            return (
              <TouchableOpacity key={r.jobId} onPress={() => setSelected(r)}>
                <Card padded={false} style={styles.report}>
                  <View style={styles.reportTop}>
                    <Ionicons name="document-text" size={18} color={colors.indigo500} />
                    <Tx size={font.sm} weight="700" color={colors.slate800} numberOfLines={1} style={{ flex: 1 }}>
                      {r.filename}
                    </Tx>
                    {r.risk ? <RiskBadge level={r.risk} /> : null}
                  </View>
                  <View style={styles.reportMeta}>
                    <Tx size={font.xs} color={colors.slate400}>
                      {formatDate(r.createdAt * 1000)}
                    </Tx>
                    {r.template ? (
                      <View style={styles.templateChip}>
                        <Ionicons name="git-compare-outline" size={12} color={colors.indigo600} />
                        <Tx size={font.xxs} color={colors.indigo700}>
                          vs {r.template}
                        </Tx>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.openRow}>
                    <Tx size={font.sm} weight="600" color={colors.indigo600}>
                      Open report
                    </Tx>
                    <Ionicons name="arrow-forward" size={16} color={colors.indigo600} />
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Tx size={font.xs} color={colors.slate400} style={{ lineHeight: 17, marginTop: spacing.lg }}>
        Reports are fetched from the server. Forensic indicators are algorithmic signals, not
        legal proof of forgery.
      </Tx>
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
  report: {
    padding: spacing.lg,
  },
  reportTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  reportMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  templateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.indigo50,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  openRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.md,
  },
  empty: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
});