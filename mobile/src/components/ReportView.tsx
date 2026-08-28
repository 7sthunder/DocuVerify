import { useState } from "react";
import { StyleSheet, Switch, TouchableOpacity, View } from "react-native";
import type { Finding, Report } from "../types";
import { colors, font, radius, spacing } from "../theme";
import { Card, Tx } from "./Ui";
import { AssessmentCard } from "./AssessmentCard";
import { PageViewer } from "./PageViewer";
import { FindingRow } from "./FindingRow";
import { FindingDetailModal } from "./FindingDetailModal";

export function ReportView({
  jobId,
  report,
  active,
  onNew,
}: {
  jobId: string;
  report: Report;
  active: boolean;
  onNew?: () => void;
}) {
  const [showOverlay, setShowOverlay] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Finding | null>(null);

  const sorted = [...report.findings].sort((a, b) => b.score - a.score);
  const overlayFindings = showOverlay ? report.findings : [];

  const select = (f: Finding) => {
    setActiveId(f.id);
    setDetail(f);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.controlRow}>
        <View style={styles.toggleRow}>
          <Switch
            value={showOverlay}
            onValueChange={setShowOverlay}
            trackColor={{ false: colors.slate300, true: colors.indigo500 }}
            thumbColor={colors.white}
          />
          <Tx size={font.sm} color={colors.slate700}>
            Show region overlays
          </Tx>
        </View>
        {onNew ? (
          <TouchableOpacity onPress={onNew} style={styles.newBtn} hitSlop={8}>
            <Tx size={font.sm} weight="600" color={colors.slate700}>
              New document
            </Tx>
          </TouchableOpacity>
        ) : null}
      </View>

      {report.reference?.enabled ? (
        <View style={styles.refBanner}>
          <Tx size={font.sm} color={colors.indigo700}>
            <Tx size={font.sm} weight="700" color={colors.indigo700}>
              Reference comparison:{" "}
            </Tx>
            document checked against official template {report.reference.template} —{" "}
            {report.reference.finding_count} template-difference finding(s).
          </Tx>
        </View>
      ) : null}

      <AssessmentCard assessment={report.assessment} />

      {report.llm?.summary ? (
        <Card style={{ borderLeftWidth: 4, borderLeftColor: colors.indigo400 }}>
          <View style={styles.llmHead}>
            <Tx size={font.sm} weight="700" color={colors.slate800} style={{ textTransform: "uppercase" }}>
              AI semantic assessment
            </Tx>
            <Tx size={font.xxs} color={colors.slate400}>
              {report.llm.finding_count} LLM findings
            </Tx>
          </View>
          <Tx size={font.sm} color={colors.slate700} style={{ marginTop: spacing.sm, lineHeight: 21 }}>
            {report.llm.summary}
          </Tx>
        </Card>
      ) : null}

      {report.llm?.error ? (
        <View style={styles.llmNote}>
          <Tx size={font.xs} color={colors.amber700}>
            LLM layer note: {report.llm.error}. Deterministic analyzers still produced the full report.
          </Tx>
        </View>
      ) : null}

      {report.pages.map((p) => (
        <PageViewer
          key={p.index}
          jobId={jobId}
          page={p}
          findings={overlayFindings}
          activeFindingId={activeId}
          onSelect={select}
          active={active}
        />
      ))}

      <View style={styles.findings}>
        <Tx size={font.md} weight="700" color={colors.slate900}>
          Findings ({report.findings.length})
        </Tx>
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          {sorted.map((f) => (
            <FindingRow key={f.id} finding={f} isActive={f.id === activeId} onPress={() => select(f)} />
          ))}
        </View>
      </View>

      <Tx size={font.xxs} color={colors.slate400} style={{ lineHeight: 16, paddingHorizontal: spacing.xs }}>
        {report.assessment.disclaimer}
      </Tx>

      <FindingDetailModal finding={detail} onClose={() => { setDetail(null); setActiveId(null); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  newBtn: {
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  refBanner: {
    backgroundColor: colors.indigo50,
    borderWidth: 1,
    borderColor: colors.indigo200 ?? colors.indigo100,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  llmHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  llmNote: {
    backgroundColor: colors.amber100,
    borderWidth: 1,
    borderColor: colors.amber200 ?? colors.amber400,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  findings: {
    paddingTop: spacing.sm,
  },
});