import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, radius, spacing } from "../theme";
import { Tx } from "./Ui";

export function AppHeader({
  onOpenSettings,
  userEmail,
}: {
  onOpenSettings: () => void;
  userEmail?: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <View style={styles.logoBox}>
          <Ionicons name="shield-checkmark" size={20} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Tx weight="700" size={font.md} color={colors.slate900}>
            DocuVerify
          </Tx>
          {userEmail ? (
            <Tx size={font.xxs} color={colors.slate500} numberOfLines={1}>
              {userEmail}
            </Tx>
          ) : null}
        </View>
      </View>
      <TouchableOpacity onPress={onOpenSettings} style={styles.iconBtn} hitSlop={8} accessibilityLabel="Settings">
        <Ionicons name="settings-outline" size={22} color={colors.slate600} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.indigo600,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});