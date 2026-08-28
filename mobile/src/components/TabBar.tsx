import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { TabKey } from "../types";
import { colors, font, radius, spacing } from "../theme";
import { Tx } from "./Ui";

const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }[] = [
  { key: "home", label: "Home", icon: "home-outline", iconActive: "home" },
  { key: "verify", label: "Verify", icon: "scan-outline", iconActive: "scan" },
  { key: "history", label: "History", icon: "time-outline", iconActive: "time" },
  { key: "reports", label: "Reports", icon: "document-text-outline", iconActive: "document-text" },
  { key: "templates", label: "Templates", icon: "albums-outline", iconActive: "albums" },
];

export function TabBar({ active, onChange }: { active: TabKey; onChange: (key: TabKey) => void }) {
  return (
    <View style={styles.bar}>
      {TABS.map(({ key, label, icon, iconActive }) => {
        const isActive = key === active;
        const color = isActive ? colors.indigo600 : colors.slate400;
        return (
          <TouchableOpacity key={key} style={styles.tab} onPress={() => onChange(key)}>
            <Ionicons name={isActive ? iconActive : icon} size={22} color={color} />
            <Tx size={font.xxs} weight={isActive ? "600" : "400"} color={color}>
              {label}
            </Tx>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
});