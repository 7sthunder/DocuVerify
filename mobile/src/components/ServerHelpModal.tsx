import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, radius, spacing } from "../theme";
import { Tx } from "./Ui";

export function ServerHelpModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Tx size={font.lg} weight="700" color={colors.slate900}>
              Connect your phone
            </Tx>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.slate500} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ marginTop: spacing.md }} bounces={false}>
            <Step n={1} title="Start the backend" body="In the backend folder, run uvicorn on all interfaces (this makes it reachable from your phone on the same Wi-Fi):">
              <Code>python -m uvicorn app.main:app --host 0.0.0.0 --port 8000</Code>
            </Step>
            <Step n={2} title="Start the auth service" body="In the auth folder, run the Better Auth service (seeds the sample user on first start):">
              <Code>npm run dev</Code>
            </Step>
            <Step n={3} title="Same network" body="Phone and computer must be on the same Wi-Fi network." />
            <Step n={4} title="Point the app at your computer" body="Tap “Detect automatically” on the login screen (or Settings → Detect) and the app probes the likely addresses for you. Using your laptop as a hotspot? The address is usually:">
              <Code>http://192.168.137.1:8000</Code>
            </Step>
            <Step n={5} title="Sign in" body={`Use ${"test@docu.com"} / ${"password"} (the sample account seeded by the auth service).`} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Step({ n, title, body, children }: { n: number; title: string; body: string; children?: React.ReactNode }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}>
        <Tx size={font.sm} weight="700" color={colors.white}>
          {n}
        </Tx>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Tx size={font.sm} weight="700" color={colors.slate800}>
          {title}
        </Tx>
        <Tx size={font.sm} color={colors.slate500} style={{ lineHeight: 19 }}>
          {body}
        </Tx>
        {children}
      </View>
    </View>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.code}>
      <Tx size={font.xs} color={colors.slate700} style={{ fontFamily: "monospace", lineHeight: 18 }}>
        {children}
      </Tx>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  sheet: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: "85%",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  step: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.indigo600,
    alignItems: "center",
    justifyContent: "center",
  },
  code: {
    backgroundColor: colors.slate100,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    marginTop: 4,
  },
});