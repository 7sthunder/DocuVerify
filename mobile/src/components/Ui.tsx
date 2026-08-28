import type { ReactNode } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, font, radius, shadow, spacing } from "../theme";

export function Tx({
  children,
  size = font.base,
  weight = "400",
  color = colors.slate800,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  size?: number;
  weight?: "400" | "500" | "600" | "700";
  color?: string;
  style?: object;
  numberOfLines?: number;
}) {
  return (
    <Text
      style={[{ fontSize: size, fontWeight: weight, color }, style]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
}

export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: object;
  padded?: boolean;
}) {
  return <View style={[styles.card, padded && styles.cardPad, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const palette: Record<string, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.indigo600, fg: colors.white },
    outline: { bg: colors.white, fg: colors.slate700, border: colors.slate300 },
    ghost: { bg: "transparent", fg: colors.indigo600 },
    danger: { bg: colors.white, fg: colors.red600, border: colors.red300 },
  };
  const p = palette[variant];
  const isOff = disabled || loading;
  return (
    <TouchableOpacity
      activeOpacity={isOff ? 1 : 0.8}
      onPress={loading ? undefined : onPress}
      disabled={isOff}
      style={[
        styles.btn,
        { backgroundColor: p.bg },
        p.border ? { borderWidth: 1, borderColor: p.border } : null,
        isOff && { opacity: 0.45 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.white : colors.indigo600} size="small" />
      ) : (
        <View style={styles.btnRow}>
          {icon}
          <Tx size={font.base} weight="600" color={p.fg}>
            {label}
          </Tx>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function Chip({
  label,
  bg = colors.slate100,
  fg = colors.slate600,
  style,
}: {
  label: string;
  bg?: string;
  fg?: string;
  style?: object;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }, style]}>
      <Tx size={font.xxs} weight="600" color={fg}>
        {label}
      </Tx>
    </View>
  );
}

export function Spinner({ label, size = "large" }: { label?: string; size?: "small" | "large" }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size={size} color={colors.indigo600} />
      {label ? (
        <Tx size={font.sm} color={colors.slate500} style={{ marginTop: spacing.md }}>
          {label}
        </Tx>
      ) : null}
    </View>
  );
}

export function Section({
  kicker,
  title,
  description,
  onAction,
  actionLabel,
}: {
  kicker?: string;
  title: string;
  description?: string;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View style={styles.sectionRow}>
        <View style={{ flex: 1 }}>
          {kicker ? (
            <Tx size={font.xxs} weight="700" color={colors.indigo600} style={{ textTransform: "uppercase", letterSpacing: 1.5 }}>
              {kicker}
            </Tx>
          ) : null}
          <Tx size={font.lg} weight="700" color={colors.slate900} style={{ marginTop: kicker ? 2 : 0 }}>
            {title}
          </Tx>
        </View>
        {onAction && actionLabel ? (
          <TouchableOpacity onPress={onAction} hitSlop={8}>
            <Tx size={font.sm} weight="600" color={colors.indigo600}>
              {actionLabel}
            </Tx>
          </TouchableOpacity>
        ) : null}
      </View>
      {description ? (
        <Tx size={font.sm} color={colors.slate500} style={{ marginTop: spacing.xs }}>
          {description}
        </Tx>
      ) : null}
    </View>
  );
}

export function Input({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoCorrect,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "email-address" | "default" | "url";
  autoCapitalize?: "none" | "sentences" | "words";
  autoCorrect?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.slate400}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      style={styles.input}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    ...shadow.card,
  },
  cardPad: {
    padding: spacing.lg,
  },
  btn: {
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "center",
  },
  chip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    fontSize: font.base,
    color: colors.slate900,
    backgroundColor: colors.white,
  },
});