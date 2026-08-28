import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../AppContext";
import { colors, font, radius, spacing } from "../theme";
import { Card, Section, Tx } from "../components/Ui";

export function TemplatesScreen({ onVerify }: { onVerify: () => void }) {
  const { history } = useApp();
  const compared = history.filter((h) => h.template);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section
        kicker="Reference mode"
        title="Official templates"
        description="Upload a reference template alongside your document to get template-difference comparison against official formatting."
      />

      <Card>
        <View style={styles.item}>
          <View style={styles.iconBox}>
            <Ionicons name="git-compare-outline" size={22} color={colors.indigo600} />
          </View>
          <View style={{ flex: 1 }}>
            <Tx size={font.sm} weight="700" color={colors.slate800}>
              How it works
            </Tx>
            <Tx size={font.xs} color={colors.slate500} style={{ lineHeight: 18, marginTop: 2 }}>
              Pick your document AND an official template on the Verify tab, then choose{" "}
              “Analyze against template”. The pipeline compares layout, margins, fonts and visual
              tiles against the template and reports differences as findings.
            </Tx>
          </View>
        </View>
        <View style={styles.item}>
          <View style={styles.iconBox}>
            <Ionicons name="document-attach" size={22} color={colors.indigo600} />
          </View>
          <View style={{ flex: 1 }}>
            <Tx size={font.sm} weight="700" color={colors.slate800}>
              Template upload
            </Tx>
            <Tx size={font.xs} color={colors.slate500} style={{ lineHeight: 18, marginTop: 2 }}>
              Template files are handled directly in the verification workspace — no separate
              library required.
            </Tx>
          </View>
        </View>
      </Card>

      {compared.length > 0 ? (
        <View style={{ marginTop: spacing.xxl }}>
          <Section kicker="History" title="Reference comparisons" />
          <View style={{ gap: spacing.sm }}>
            {compared.map((h) => (
              <Card padded={false} key={h.jobId} style={styles.row}>
                <Ionicons name="document-text-outline" size={16} color={colors.indigo500} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx size={font.sm} weight="600" color={colors.slate800} numberOfLines={1}>
                    {h.filename}
                  </Tx>
                  <Tx size={font.xs} color={colors.slate400}>
                    template: {h.template}
                  </Tx>
                </View>
              </Card>
            ))}
          </View>
        </View>
      ) : null}

      <Card style={styles.note}>
        <TouchableOpacity onPress={onVerify} style={styles.noteLink} hitSlop={8}>
          <Tx size={font.xs} weight="700" color={colors.indigo600}>
            Reference comparison is available on the Verify tab →
          </Tx>
        </TouchableOpacity>
      </Card>
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
    paddingBottom: spacing.xxxl,
  },
  item: {
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.indigo50,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  note: {
    marginTop: spacing.xxl,
  },
  noteLink: {
    alignSelf: "flex-start",
  },
});