import { useEffect, useRef, useState } from "react";
import { Modal, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../AppContext";
import { autoFindServer, checkHealth } from "../api";
import { unpinServer } from "../storage";
import { colors, font, radius, spacing } from "../theme";
import { Button, Input, Tx } from "./Ui";

export function SettingsModal({
  visible,
  onClose,
  onOpenServerHelp,
}: {
  visible: boolean;
  onClose: () => void;
  onOpenServerHelp: () => void;
}) {
  const { serverUrl, setServerUrl, session, logout } = useApp();
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState(serverUrl);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean | null; message: string }>({
    ok: null,
    message: "",
  });
  const editedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      editedRef.current = false;
      setUrl(serverUrl);
      setSaveState("idle");
      setTestResult({ ok: null, message: "" });
    }
  }, [visible, serverUrl]);

  // Auto-save the URL ~1s after the user stops typing it — only when the user
  // actually edited the field, so an auto-detected value is never "pinned".
  useEffect(() => {
    if (!visible || !editedRef.current) return;
    const clean = url.trim().replace(/\/+$/, "");
    if (!clean || clean === serverUrl || !/^https?:\/\//.test(clean)) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null;
      await setServerUrl(clean, { pin: true });
      setSaveState("saved");
    }, 700);
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, [url, visible, serverUrl, setServerUrl]);

  const sync = async () => {
    setTestResult({ ok: null, message: "" });
    if (!url.trim()) {
      setTestResult({ ok: false, message: "Enter a server address first." });
      return;
    }
    setTesting(true);
    try {
      await setServerUrl(url, { pin: true });
      await checkHealth();
      setTestResult({ ok: true, message: "Connected — DocuVerify API is reachable." });
    } catch (e) {
      setTestResult({
        ok: false,
        message: e instanceof Error ? e.message : "Connection failed.",
      });
    } finally {
      setTesting(false);
    }
  };

  const onDetect = async () => {
    setTestResult({ ok: null, message: "" });
    setDetecting(true);
    try {
      const found = await autoFindServer();
      if (found) {
        setUrl(found);
        await setServerUrl(found, { pin: true });
        setTestResult({ ok: true, message: `Found: ${found}` });
      } else {
        setTestResult({
          ok: false,
          message: "No reachable DocuVerify server found. Start the backend first.",
        });
      }
    } finally {
      setDetecting(false);
    }
  };

  const onReset = async () => {
    setTestResult({ ok: null, message: "" });
    setSaveState("idle");
    await unpinServer();
    await setServerUrl("");
    setUrl("");
    editedRef.current = false;
    const found = await autoFindServer();
    if (found) {
      setUrl(found);
      await setServerUrl(found, { pin: true });
      setTestResult({ ok: true, message: `Reconnected to ${found}` });
    } else {
      setTestResult({ ok: false, message: "Server cleared — restart the backend, then press Detect." });
    }
  };

  const saveAndClose = async () => {
    if (!url.trim()) return;
    setSaving(true);
    await setServerUrl(url, { pin: true });
    setSaving(false);
    onClose();
  };

  const doLogout = async () => {
    await logout();
    onClose();
  };

  const user = session?.user;
  const userName = user?.name?.trim() || user?.email?.split("@")[0] || "User";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.filler} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xxl }]}>
          <View style={styles.head}>
            <Tx size={font.lg} weight="700" color={colors.slate900}>
              Settings
            </Tx>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.slate500} />
            </TouchableOpacity>
          </View>

          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Tx size={font.md} weight="700" color={colors.indigo700}>
                {initials(userName)}
              </Tx>
            </View>
            <View style={{ flex: 1 }}>
              <Tx size={font.md} weight="600" color={colors.slate800}>
                {userName}
              </Tx>
              <Tx size={font.xs} color={colors.slate500} numberOfLines={1}>
                {user?.email ?? ""}
              </Tx>
            </View>
          </View>

          <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
            <Tx size={font.sm} weight="500" color={colors.slate700}>
              DocuVerify server
            </Tx>
            <Input
              value={url}
              onChangeText={(v) => {
                editedRef.current = true;
                setUrl(v);
              }}
              placeholder="http://192.168.1.20:8000"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.usingRow}>
              <Ionicons name="radio-button-on" size={12} color={serverUrl ? colors.emerald600 : colors.slate400} />
              <Tx size={font.xs} color={serverUrl ? colors.slate600 : colors.slate400} numberOfLines={1} style={{ flex: 1 }}>
                Using: {serverUrl || "not set"}
              </Tx>
            </View>
            {saveState === "saving" || saveState === "saved" ? (
              <View style={styles.saveRow}>
                {saveState === "saving" ? (
                  <>
                    <Ionicons name="sync-outline" size={14} color={colors.slate500} />
                    <Tx size={font.xs} color={colors.slate500}>
                      Saving…
                    </Tx>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={14} color={colors.emerald600} />
                    <Tx size={font.xs} color={colors.emerald700}>
                      Saved automatically
                    </Tx>
                  </>
                )}
              </View>
            ) : null}
            <View style={styles.rowBetween}>
              <TouchableOpacity onPress={onOpenServerHelp} hitSlop={8}>
                <Tx size={font.xs} weight="600" color={colors.indigo600}>
                  How to connect your phone →
                </Tx>
              </TouchableOpacity>
              <View style={styles.testRow}>
                <Button label={detecting ? "Detecting…" : "Detect"} variant="outline" onPress={onDetect} loading={detecting} />
                <Button label={testing ? "Testing…" : "Test"} variant="outline" onPress={sync} loading={testing} />
              </View>
            </View>
            {testResult.message ? (
              <View style={[styles.testBox, testResult.ok ? styles.testOk : styles.testErr]}>
                <Tx size={font.xs} color={testResult.ok ? colors.emerald700 : colors.red700}>
                  {testResult.message}
                </Tx>
              </View>
            ) : null}
            <TouchableOpacity onPress={onReset} hitSlop={8} style={{ alignSelf: "flex-start" }}>
              <Tx size={font.xs} weight="600" color={colors.red600}>
                Reset server (re-detect from scratch)
              </Tx>
            </TouchableOpacity>
          </View>

          <View style={styles.actions}>
            <Button label="Save" onPress={saveAndClose} loading={saving} />
            <Button label="Sign out" variant="danger" onPress={doLogout} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function initials(name: string) {
  return name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  filler: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.lg,
    backgroundColor: colors.indigo50,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.indigo100,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  testRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  saveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.xs,
  },
  usingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  testBox: {
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
  },
  testOk: {
    backgroundColor: colors.emerald100,
    borderColor: colors.emerald500,
  },
  testErr: {
    backgroundColor: colors.red100,
    borderColor: colors.red200,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
});