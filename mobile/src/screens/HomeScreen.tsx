import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { JobSummary } from "../types";
import { listJobs } from "../api";
import { useApp } from "../AppContext";
import { colors, font, radius, shadow, spacing } from "../theme";
import { Card, Section, Tx } from "../components/Ui";
import { formatDate, riskTone } from "../utils";

const FEATURES = ["Explainable Results", "Highlights Suspicious Regions", "Multi-layer Forensic Analysis"];

const CATEGORIES = [
  { name: "Typography", icon: "text-outline" as const, desc: "Font anomalies" },
  { name: "Layout", icon: "grid-outline" as const, desc: "Alignment & spacing" },
  { name: "Visual", icon: "image-outline" as const, desc: "Pixel & texture signals" },
  { name: "Semantic", icon: "chatbox-ellipses-outline" as const, desc: "Content consistency" },
  { name: "Text layer", icon: "document-text-outline" as const, desc: "Native vs OCR text" },
  { name: "Metadata", icon: "information-circle-outline" as const, desc: "Producer & timestamps" },
];

const STEPS = [
  { title: "Upload", desc: "PDF, JPG or PNG from your device." },
  { title: "Analyze", desc: "Extraction + multi-signal forensic pipeline." },
  { title: "Assess", desc: "Score, risk level and highlighted regions." },
];

export function HomeScreen({
  onVerify,
  onOpenHistory,
  onOpenReports,
  onOpenTemplates,
}: {
  onVerify: () => void;
  onOpenHistory: () => void;
  onOpenReports: () => void;
  onOpenTemplates: () => void;
}) {
  const { history } = useApp();
  const [serverJobs, setServerJobs] = useState<JobSummary[]>([]);
  const recent = history.slice(0, 3);

  useEffect(() => {
    let alive = true;
    listJobs()
      .then((rows) => { if (alive) { setServerJobs(rows); } })
      .catch(() => { /* keep using local history */ });
    return () => { alive = false; };
  }, []);

  const recentJobs: JobSummary[] = serverJobs.length > 0
    ? serverJobs.slice(0, 3)
    : history.slice(0, 3).map((h) => ({
        id: h.jobId,
        filename: h.filename,
        created: h.createdAt,
        status: "completed" as const,
        score: h.score ?? 0,
        risk_level: (h.risk ?? "LOW") as "LOW" | "MEDIUM" | "HIGH",
      }));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroChip}>
          <Ionicons name="sparkles" size={14} color={colors.indigo700} />
          <Tx size={font.xs} weight="600" color={colors.indigo700}>
            AI-Powered Forensic Analysis
          </Tx>
        </View>
        <Tx size={font.xxl} weight="700" color={colors.slate900} style={{ marginTop: spacing.md }}>
          Verify Documents.
        </Tx>
        <Tx size={font.xxl} weight="700" color={colors.indigo600}>
          Trust with Evidence.
        </Tx>
        <Tx size={font.sm} color={colors.slate500} style={{ lineHeight: 21, marginTop: spacing.md }}>
          DocuVerify analyzes document structure, typography, visual elements, metadata and content
          consistency to detect potential manipulations and provide explainable authenticity
          assessments.
        </Tx>

        <View style={styles.featureList}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.checkRow}>
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={13} color={colors.emerald600} />
              </View>
              <Tx size={font.sm} weight="500" color={colors.slate700}>
                {f}
              </Tx>
            </View>
          ))}
        </View>

        <View style={styles.heroActions}>
          <TouchableOpacity onPress={onVerify} style={styles.primaryBtn}>
            <Tx size={font.base} weight="600" color={colors.white}>
              Verify a Document
            </Tx>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onOpenTemplates} style={styles.secondaryBtn}>
            <Tx size={font.base} weight="600" color={colors.slate700}>
              Reference templates
            </Tx>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.flowStrip}>
        {STEPS.map((s, i) => (
          <View key={s.title} style={styles.flowItem}>
            <View style={styles.flowIcon}>
              <Ionicons name={i === 0 ? "cloud-upload-outline" : i === 1 ? "scan-outline" : "shield-checkmark-outline"} size={20} color={colors.indigo600} />
            </View>
            <Tx size={font.sm} weight="600" color={colors.slate800}>
              {s.title}
            </Tx>
            <Tx size={font.xs} color={colors.slate500} style={{ textAlign: "center", lineHeight: 16 }}>
              {s.desc}
            </Tx>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Section
          kicker="Signals"
          title="Analysis categories"
          description="Every module emits evidence-based findings — signals, not verdicts."
        />
        <View style={styles.catGrid}>
          {CATEGORIES.map((c) => (
            <View key={c.name} style={styles.catCard}>
              <Ionicons name={c.icon} size={20} color={colors.indigo600} />
              <Tx size={font.sm} weight="600" color={colors.slate800}>
                {c.name}
              </Tx>
              <Tx size={font.xs} color={colors.slate500}>
                {c.desc}
              </Tx>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Section
          kicker="Activity"
          title="Recent verifications"
          description="Your latest results — tap one to reopen its forensic report."
          onAction={history.length ? onOpenHistory : undefined}
          actionLabel={history.length ? "View all" : undefined}
        />
        {recentJobs.length === 0 ? (
          <Card>
            <View style={styles.emptyRow}>
              <Ionicons name="time-outline" size={22} color={colors.slate400} />
              <Tx size={font.sm} color={colors.slate500} style={{ flex: 1 }}>
                No verifications yet — pick a document on the Verify tab.
              </Tx>
              <TouchableOpacity onPress={onVerify} hitSlop={8}>
                <Ionicons name="arrow-forward" size={18} color={colors.indigo600} />
              </TouchableOpacity>
            </View>
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {recentJobs.map((r) => {
              const tone = riskTone(r.risk_level);
              return (
                <TouchableOpacity key={r.id} onPress={onOpenHistory}>
                  <Card padded={false} style={styles.historyRow}>
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
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <Card style={styles.trust}>
        <View style={styles.trustHead}>
          <Ionicons name="shield-checkmark" size={18} color={colors.emerald600} />
          <Tx size={font.sm} weight="700" color={colors.slate800}>
            Evidence-based, never legal proof
          </Tx>
        </View>
        <Tx size={font.xs} color={colors.slate500} style={{ lineHeight: 18, marginTop: spacing.sm }}>
          Forensic indicators are algorithmic signals, not legal proof of forgery. Every report is
          explainable, signals are heuristic, and limitations are always reported.
        </Tx>
      </Card>
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
  hero: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow.card,
  },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    backgroundColor: colors.indigo50,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  featureList: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.emerald100,
    alignItems: "center",
    justifyContent: "center",
  },
  heroActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.indigo600,
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  secondaryBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.slate300,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  flowStrip: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  flowItem: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
  },
  flowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.indigo50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  section: {
    marginTop: spacing.xxxl,
  },
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  catCard: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 3,
    ...shadow.card,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  riskPill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  trust: {
    marginTop: spacing.xxxl,
    backgroundColor: colors.white,
  },
  trustHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});