import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { detectDefaultServer, autoFindServer } from "../api";
import { useApp } from "../AppContext";
import { colors, font, radius, shadow, spacing } from "../theme";
import { Button, Card, Input, Tx } from "../components/Ui";

export function LoginScreen({ onOpenServerHelp }: { onOpenServerHelp: () => void }) {
  const { serverUrl, setServerUrl, login } = useApp();
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("test@docu.com");
  const [password, setPassword] = useState("password");
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editedRef = useRef(false);

  useEffect(() => {
    if (!serverUrl) {
      setUrl(detectDefaultServer());
    } else {
      setUrl(serverUrl);
    }
    editedRef.current = false;
  }, [serverUrl]);

  // Auto-save a URL the user typed — but only if they edited it, and never pin
  // an auto-detected default.
  useEffect(() => {
    if (!editedRef.current) return;
    const clean = url.trim().replace(/\/+$/, "");
    if (!clean || !/^https?:\/\//.test(clean) || clean === serverUrl) return;
    const t = setTimeout(() => {
      setServerUrl(clean, { pin: true });
    }, 700);
    return () => clearTimeout(t);
  }, [url, serverUrl, setServerUrl]);

  const onDetect = async () => {
    setDetecting(true);
    setError(null);
    try {
      const found = await autoFindServer();
      if (found) {
        setUrl(found);
      } else {
        setError("No reachable DocuVerify server found. Start the backend, then enter its address.");
      }
    } finally {
      setDetecting(false);
    }
  };

  const submit = async () => {
    if (!url.trim()) {
      setError("Please enter the DocuVerify server address.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await setServerUrl(url, { pin: true });
      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={styles.logoBox}>
            <Ionicons name="shield-checkmark" size={30} color={colors.white} />
          </View>
          <Tx size={font.xl} weight="700" color={colors.slate900}>
            DocuVerify
          </Tx>
          <Tx size={font.sm} color={colors.slate500} style={{ textAlign: "center" }}>
            Intelligent Document Authenticity & Forgery Detection
          </Tx>
        </View>

        <Card style={{ marginTop: spacing.xxl }}>
          <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.sm }}>
              <Tx size={font.sm} weight="500" color={colors.slate700}>
                Server address
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
              <View style={styles.helpRow}>
                <TouchableOpacity onPress={onDetect} disabled={detecting} hitSlop={8}>
                  <Tx size={font.xs} weight="600" color={colors.indigo600}>
                    {detecting ? "Detecting…" : "Detect automatically"}
                  </Tx>
                </TouchableOpacity>
                <TouchableOpacity onPress={onOpenServerHelp} hitSlop={8}>
                  <Tx size={font.xs} weight="600" color={colors.indigo600}>
                    Connect my phone →
                  </Tx>
                </TouchableOpacity>
              </View>
              <Tx size={font.xs} color={colors.slate400}>
                Detected from Expo Go, or found by probing. Fix it manually if your backend lives
                elsewhere.
              </Tx>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Input
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                secureTextEntry
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Tx size={font.sm} color={colors.red700}>
                  {error}
                </Tx>
              </View>
            ) : null}

            <Button label={loading ? "Signing in…" : "Sign in"} onPress={submit} loading={loading} />

            <View style={styles.sampleBox}>
              <Tx size={font.xs} weight="600" color={colors.slate600}>
                Sample credentials
              </Tx>
              <Tx size={font.xs} color={colors.slate500} style={{ fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }) }}>
                email:    test@docu.com
              </Tx>
              <Tx size={font.xs} color={colors.slate500} style={{ fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }) }}>
                password: password
              </Tx>
            </View>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.slate100,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  helpRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  brand: {
    alignItems: "center",
    gap: spacing.sm,
  },
  logoBox: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.indigo600,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.raised,
  },
  errorBox: {
    backgroundColor: colors.red100,
    borderWidth: 1,
    borderColor: colors.red200 ?? colors.red400,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  sampleBox: {
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
    paddingTop: spacing.lg,
    gap: 2,
  },
});