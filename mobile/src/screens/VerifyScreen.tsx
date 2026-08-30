import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { JobStatus, PickedFile } from "../types";
import { pollJob, uploadCompare, uploadDocument, autoFindServer, autoFindServers, uploadToAny, probeServer } from "../api";
import { getServerUrlSync } from "../storage";
import { useApp } from "../AppContext";
import { colors, font, radius, spacing } from "../theme";
import { Button, Card, Spinner, Tx } from "../components/Ui";
import { FilePickerField } from "../components/FilePickerField";
import { ReportView } from "../components/ReportView";

type Phase = "idle" | "uploading" | "processing" | "done" | "error";

export function VerifyScreen({ active, onOpenSettings }: { active: boolean; onOpenSettings: () => void }) {
  const { history, addHistory, upsertHistory, setServerUrl } = useApp();
  const [phase, setPhase] = useState<Phase>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [docFile, setDocFile] = useState<PickedFile | null>(null);
  const [tplFile, setTplFile] = useState<PickedFile | null>(null);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState<string | null>(null);
  const runningRef = useRef(false);
  const cancelledRef = useRef(false);
  const runToken = useRef(0);

  const reset = () => {
    runningRef.current = false;
    cancelledRef.current = true;
    runToken.current += 1;
    setDocFile(null);
    setTplFile(null);
    setJob(null);
    setJobId(null);
    setError(null);
    setFilename("");
    setPhase("idle");
  };

  const cancel = () => {
    runningRef.current = false;
    cancelledRef.current = true;
    runToken.current += 1;
    setJob(null);
    setJobId(null);
    setError(null);
    setPhase("idle");
  };

  const run = async () => {
    if (!docFile || runningRef.current) return;
    runningRef.current = true;
    cancelledRef.current = false;
    const token = ++runToken.current;
    setError(null);
    setFilename(docFile.name);
    setPhase("uploading");
    try {
      // Build the ordered candidate list. A stored server that's still live is
      // preferred (fast path); otherwise fall back to discovery. We then try
      // EVERY candidate for the actual upload — a GET health probe is not proof
      // a multipart POST will succeed from the phone (the 172.19.x Wi-Fi adapter
      // answered GET but rejected uploads), so we must be ready to fall through.
      const bases: string[] = [];
      const stored = getServerUrlSync();
      if (stored && (await probeServer(stored))) bases.push(stored);
      if (token !== runToken.current) return;

      for (const c of await autoFindServers()) {
        if (!bases.includes(c)) bases.push(c);
      }
      if (bases.length === 0) {
        runningRef.current = false;
        setError(
          "DocuVerify server is unreachable. Start the backend, then tap “Fix server connection” (or Settings → Detect)."
        );
        setPhase("error");
        return;
      }

      const uploadResult = await uploadToAny(docFile, tplFile, bases);
      // Pin the exact server that accepted the upload so report images load from
      // the same working address.
      if (uploadResult.base !== getServerUrlSync()) {
        await setServerUrl(uploadResult.base, { pin: true });
      }
      let job_id = uploadResult.job_id;
      if (token !== runToken.current) return;
      if (token !== runToken.current) return;
      setJobId(job_id);
      setPhase("processing");
      let done: JobStatus;
      try {
        done = await pollJob(
          job_id,
          (j) => {
            if (token === runToken.current) setJob(j);
          },
          () => cancelledRef.current
        );
      } catch (pollError) {
        const pollMsg = pollError instanceof Error ? pollError.message : "";
        if (
          cancelledRef.current ||
          runToken.current !== token ||
          !/restarted|not found/i.test(pollMsg)
        ) {
          throw pollError;
        }
        // Backend restarted mid-analysis (its in-memory job store is gone):
        // re-upload the same document once instead of dead-ending in an
        // error card.
        const retry = tplFile
          ? await uploadCompare(docFile, tplFile, getServerUrlSync())
          : await uploadDocument(docFile, getServerUrlSync());
        if (token !== runToken.current) return;
        job_id = retry.job_id;
        setJobId(job_id);
        done = await pollJob(
          job_id,
          (j) => {
            if (token === runToken.current) setJob(j);
          },
          () => cancelledRef.current
        );
      }
      if (token !== runToken.current) return;

      runningRef.current = false;
      setJob(done);
      if (done.status === "complete") {
        if (!done.report) {
          setError("Analysis completed without a report.");
          setPhase("error");
          return;
        }
        setPhase("done");
        const prior = history.find((h) => h.jobId === job_id);
        await upsertHistory({
          jobId: job_id,
          filename: done.filename,
          createdAt: prior?.createdAt ?? Date.now(),
          score: done.report.assessment.suspicion_score,
          risk: done.report.assessment.risk_level,
          template: tplFile?.name ?? null,
          status: "complete",
          error: null,
          report: done.report,
        });
      } else {
        setError(done.error ?? "Analysis failed");
        setPhase("error");
        await addHistory({
          jobId: job_id,
          filename: done.filename,
          createdAt: Date.now(),
          score: null,
          risk: null,
          template: tplFile?.name ?? null,
          status: "failed",
          error: done.error ?? "Analysis failed",
          report: null,
        });
      }
    } catch (e) {
      if (cancelledRef.current || runToken.current !== token) return;
      runningRef.current = false;
      setError(e instanceof Error ? e.message : "Upload failed.");
      setPhase("error");
    }
  };

  const report = job?.report;

  const isNetworkError = /reach the server|timed? ?out/i.test(error ?? "");

  const fixAndRetry = async () => {
    setError(null);
    const found = await autoFindServer();
    if (found) {
      await setServerUrl(found, { pin: true });
      await run();
    } else {
      setError("Still can't find the DocuVerify server. Open Settings to set the address manually.");
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {phase === "idle" ? (
        <Card>
          <Tx size={font.md} weight="700" color={colors.slate800}>
            Verify a document
          </Tx>
          <Tx size={font.sm} color={colors.slate500} style={{ lineHeight: 20, marginTop: 4 }}>
            Upload a PDF, JPG or PNG. DocuVerify extracts text, layout, typography, visual and
            metadata signals and produces an explainable forensic assessment with highlighted
            suspicious regions.
          </Tx>

          <View style={{ gap: spacing.lg, marginTop: spacing.lg }}>
            <FilePickerField
              file={docFile}
              onSelect={setDocFile}
              onRemove={() => setDocFile(null)}
              label="Document to verify *"
              accent
            />
            <FilePickerField
              file={tplFile}
              onSelect={setTplFile}
              onRemove={() => setTplFile(null)}
              label="Official template"
              hint="Optional — enables reference comparison"
            />
            <Button
              label={tplFile ? "Analyze against template" : "Analyze document"}
              onPress={run}
              disabled={!docFile}
              icon={<Ionicons name="flask-outline" size={18} color={colors.white} />}
            />
          </View>
        </Card>
      ) : null}

      {(phase === "uploading" || phase === "processing") ? (
        <Card style={styles.centerCard}>
          <Spinner
            label={phase === "uploading" ? "Uploading…" : "Analyzing document…"}
          />
          <Tx size={font.sm} color={colors.slate500} style={{ marginTop: spacing.xs }}>
            {filename}
          </Tx>
          <Tx size={font.xs} color={colors.slate400} style={{ marginTop: spacing.md, textAlign: "center" }}>
            OCR, layout, typography, visual, metadata &amp; semantic checks
          </Tx>
          <View style={{ marginTop: spacing.lg, alignSelf: "stretch" }}>
            <Button label="Cancel" variant="ghost" onPress={cancel} />
          </View>
        </Card>
      ) : null}

      {phase === "error" ? (
        <Card style={styles.centerCard}>
          <Ionicons name="alert-circle" size={34} color={colors.red600} />
          <Tx size={font.md} weight="700" color={colors.red600} style={{ marginTop: spacing.sm }}>
            Analysis failed
          </Tx>
          <Tx size={font.sm} color={colors.slate600} style={{ textAlign: "center", marginTop: 4 }}>
            {error}
          </Tx>
          <View style={{ marginTop: spacing.lg, alignSelf: "stretch", gap: spacing.md }}>
            {isNetworkError ? (
              <>
                <Button
                  label="Fix server connection"
                  onPress={fixAndRetry}
                  icon={<Ionicons name="wifi-outline" size={18} color={colors.white} />}
                />
                <Button label="Open Settings" variant="outline" onPress={onOpenSettings} />
              </>
            ) : null}
            <Button label="Try another document" variant="outline" onPress={() => setPhase("idle")} />
          </View>
        </Card>
      ) : null}

      {phase === "done" && jobId && report ? (
        <ReportView jobId={jobId} report={report} active={active} onNew={reset} />
      ) : null}
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
  },
  centerCard: {
    alignItems: "center",
    gap: 2,
    paddingVertical: spacing.xxxl,
  },
});