import { Alert, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import type { PickedFile } from "../types";
import { colors, font, radius, spacing } from "../theme";
import { Tx } from "./Ui";

const ALLOWED = /\.(pdf|jpe?g|png)$/i;

export function FilePickerField({
  file,
  label,
  hint,
  accent,
  onSelect,
  onRemove,
}: {
  file: PickedFile | null;
  label: string;
  hint?: string;
  accent?: boolean;
  onSelect: (file: PickedFile) => void;
  onRemove?: () => void;
}) {
  const pick = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled) return;
      const a = res.assets[0];
      if (!ALLOWED.test(a.name) && !/pdf|jpeg|png/i.test(a.mimeType ?? "")) {
        Alert.alert("Unsupported file", "Please choose a PDF, JPG or PNG document.");
        return;
      }
      onSelect({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? null, size: a.size ?? null });
    } catch {
      Alert.alert("Pick failed", "Could not open the document picker.");
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Tx size={font.sm} weight="500" color={colors.slate700}>
          {label}
        </Tx>
        {hint ? (
          <Tx size={font.xs} color={colors.slate400}>
            {hint}
          </Tx>
        ) : null}
      </View>

      {file ? (
        <View style={[styles.picked, { borderColor: accent ? colors.indigo300 : colors.slate300 }]}>
          <Ionicons name="document-attach" size={20} color={colors.emerald600} />
          <View style={{ flex: 1 }}>
            <Tx size={font.sm} weight="600" color={colors.slate800} numberOfLines={2}>
              {file.name}
            </Tx>
            {file.size ? (
              <Tx size={font.xs} color={colors.slate400}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </Tx>
            ) : null}
          </View>
          {onRemove ? (
            <TouchableOpacity onPress={onRemove} hitSlop={8}>
              <Tx size={font.xs} weight="600" color={colors.red600}>
                Remove
              </Tx>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <TouchableOpacity
          onPress={pick}
          style={[styles.dropzone, accent ? styles.dropzoneAccent : null]}
        >
          <Ionicons name="cloud-upload-outline" size={22} color={colors.slate400} />
          <Tx size={font.sm} weight="500" color={colors.slate600}>
            Choose a file
          </Tx>
          <Tx size={font.xs} color={colors.slate400}>
            PDF, JPG or PNG
          </Tx>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  picked: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: colors.slate50,
    padding: spacing.md,
  },
  dropzone: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.slate300,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingVertical: spacing.xl,
  },
  dropzoneAccent: {
    borderColor: colors.slate400,
  },
});