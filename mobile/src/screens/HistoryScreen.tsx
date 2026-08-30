import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { HistoryItem, JobSummary } from "../types";
import { listJobs } from "../api";
import { colors, font, radius, spacing } from "../theme";
import { Card, Section, Tx } from "../components/Ui";
import { ReportDetail } from "../components/ReportDetail";
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

export function HistoryScreen({ active }: { active: boolean }) {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HistoryItem | null>(null);

  useEffect(() => {
    let alive = true;
    listJobs()
      .then((rows) => { if (alive) { setJobs(rows); } })
      .catch(() => { if (alive) { setJobs([]); } })
      .finally(() => { if (alive) { setLoading(false); } });
    return () => { alive = false; };
  }, []);

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
      {loading ? (
        <Card>
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={30} color={colors.slate300} />
            <Tx size={font.sm} color={colors.slate500} style={{ textAlign: "center", marginTop: spacing.sm }}>
              Loading verifications…
            </Tx>
          </View>
        </Card>
      ) : jobs.length === 0 ? (
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
          {jobs.map((r) => {
            const tone = riskTone(r.risk_level);
            return (
              <TouchableOpacity key={r.id} onPress={() => setSelected(toHistoryItem(r))}>
                <Card padded={false} style={styles.row}>
                  <Ionicons name="document-attach" size={18} color={colors.indigo500} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Tx size={font.sm} weight="600" color={colors.slate800} numberOfLines={1}>
                      {r.filename}
                    </Tx>
                    <Tx size={font.xs} color={colors.slate400}>
                        {formatDate(r.created * 1000)}
                    </Tx>
                  </View>
                  <View style={[styles.riskPill, { backgroundColor: tone.bg }]}>
                    <Tx size={font.xxs} weight="700" color={tone.fg}>
                      {r.risk_level}
                    </Tx>
                  </View>
                  <Tx size={font.sm} weight="700" color={colors.slate800}>
                    {Math.round(r.score)}
                  </Tx>
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