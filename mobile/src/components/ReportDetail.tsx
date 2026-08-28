import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { HistoryItem, JobStatus, Report } from "../types";
import { getJob } from "../api";
import { colors, font, radius, spacing } from "../theme";
import { Card, Spinner, Tx } from "./Ui";
import { ReportView } from "./ReportView";
import { formatDate } from "../utils";

export function ReportDetail({
  item,
  onBack,
  active,
}: {
  item: HistoryItem;
  onBack: () => void;
  active: boolean;
}) {
  const [live, setLive] = useState<Report | null>(null);
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  const loadLive = useCallback(async () => {
    setLoadingLive(true);
    setLiveError(null);
    try {
      const job = (await getJob(item.jobId)) as JobStatus;
      if (job.status === "complete" && job.report) {
        setLive(job.report);
      } else {
        setLive(null);
        setLiveError(job.error ?? "This saved job is no longer available on the server.");
      }
    } catch (e) {
      setLive(null);
      setLiveError(e instanceof Error ? e.message : "Could not reload this report.");
    } finally {
      setLoadingLive(false);
    }
  }, [item.jobId]);

  useEffect(() => {
    if (!item.report && item.status === "complete") loadLive();
    return () => {
      setLive(null);
      setLiveError(null);
      setLoadingLive(false);
    };
  }, [item.jobId, item.report, item.status, loadLive]);

  return (
    <View style={styles.root}>
      <View style={styles.backRow}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.slate700} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Tx size={font.md} weight="700" color={colors.slate900} numberOfLines={1}>
            {item.filename}
          </Tx>
          <Tx size={font.xs} color={colors.slate400}>
            {formatDate(item.createdAt)}
          </Tx>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {item.report ? (
          <ReportView jobId={item.jobId} report={item.report} active={active} />
        ) : loadingLive ? (
          <Card>
            <Spinner label="Reloading report…" />
          </Card>
        ) : live ? (
          <ReportView jobId={item.jobId} report={live} active={active} />
        ) : (
          <Card style={styles.centerCard}>
            <Ionicons name="information-circle-outline" size={32} color={colors.slate400} />
            <Tx size={font.sm} color={colors.slate600} style={{ textAlign: "center", marginTop: spacing.sm }}>
              {liveError ?? (item.status === "failed" ? (item.error ?? "Analysis failed.") : "No report available.")}
            </Tx>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.slate50,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.slate100,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  centerCard: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
});