import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppProvider, useApp } from "./src/AppContext";
import type { TabKey } from "./src/types";
import { AppHeader } from "./src/components/AppHeader";
import { TabBar } from "./src/components/TabBar";
import { SettingsModal } from "./src/components/SettingsModal";
import { ServerHelpModal } from "./src/components/ServerHelpModal";
import { Spinner } from "./src/components/Ui";
import { colors } from "./src/theme";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { VerifyScreen } from "./src/screens/VerifyScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { ReportsScreen } from "./src/screens/ReportsScreen";
import { TemplatesScreen } from "./src/screens/TemplatesScreen";

function Root() {
  const { booted, session } = useApp();
  if (!booted) {
    return (
      <View style={styles.splash}>
        <Spinner label="Loading DocuVerify…" />
      </View>
    );
  }
  return session ? <Main /> : <LoginGate />;
}

function LoginGate() {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <>
      <StatusBar style="dark" />
      <LoginScreen onOpenServerHelp={() => setHelpOpen(true)} />
      <ServerHelpModal visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}

function Main() {
  const { session } = useApp();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>("home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <View style={styles.main}>
      <StatusBar style="dark" />
      <View style={{ paddingTop: insets.top, backgroundColor: colors.white }}>
        <AppHeader
          onOpenSettings={() => setSettingsOpen(true)}
          userEmail={session?.user.email ?? undefined}
        />
      </View>

      <View style={styles.body}>
        <View style={[styles.tab, tab === "home" ? null : styles.hidden]}>
          <HomeScreen
            onVerify={() => setTab("verify")}
            onOpenHistory={() => setTab("history")}
            onOpenReports={() => setTab("reports")}
            onOpenTemplates={() => setTab("templates")}
          />
        </View>
        <View style={[styles.tab, tab === "verify" ? null : styles.hidden]}>
          <VerifyScreen active={tab === "verify"} onOpenSettings={() => setSettingsOpen(true)} />
        </View>
        <View style={[styles.tab, tab === "history" ? null : styles.hidden]}>
          <HistoryScreen active={tab === "history"} />
        </View>
        <View style={[styles.tab, tab === "reports" ? null : styles.hidden]}>
          <ReportsScreen active={tab === "reports"} />
        </View>
        <View style={[styles.tab, tab === "templates" ? null : styles.hidden]}>
          <TemplatesScreen onVerify={() => setTab("verify")} />
        </View>
      </View>

      <View style={{ paddingBottom: insets.bottom, backgroundColor: colors.white }}>
        <TabBar active={tab} onChange={setTab} />
      </View>

      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenServerHelp={() => {
          setSettingsOpen(false);
          setHelpOpen(true);
        }}
      />
      <ServerHelpModal visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Root />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.slate50,
  },
  main: {
    flex: 1,
    backgroundColor: colors.slate50,
  },
  body: {
    flex: 1,
  },
  tab: {
    flex: 1,
  },
  hidden: {
    display: "none",
  },
});