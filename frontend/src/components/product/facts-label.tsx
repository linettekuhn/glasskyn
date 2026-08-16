import { ReactNode } from "react";
import {
  StyleProp,
  StyleSheet,
  useColorScheme,
  View,
  ViewStyle,
} from "react-native";
import { ThemedText } from "../ui/themed-text";

const LABEL_PADDING = 16;
const DOT_LEADER = ".".repeat(200);
import { Colors } from "@/constants/theme";

export interface FactsColors {
  bg: string;
  ink: string;
  muted: string;
  rule: string;
  softRule: string;
}

export function useFactsColors(): FactsColors {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  return {
    bg: colors.background,
    ink: colors.text,
    muted: colors.neutral[800],
    rule: colors.neutral[600],
    softRule: colors.neutral[500],
  };
}

interface FactsLabelProps {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export function FactsLabel({ style, children }: FactsLabelProps) {
  const colors = useFactsColors();
  return (
    <View
      style={[
        styles.label,
        {
          backgroundColor: colors.bg,
          borderColor: colors.rule,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface FactsHeadingProps {
  title: string;
  style?: StyleProp<ViewStyle>;
}

export function FactsHeading({ title, style }: FactsHeadingProps) {
  const colors = useFactsColors();
  return (
    <View style={[styles.headingWrap, style]}>
      <ThemedText weight="extraBold" type="h6" sansItalic>
        {title}
      </ThemedText>
    </View>
  );
}

interface FactsRuleProps {
  style?: StyleProp<ViewStyle>;
}

export function FactsRule({ style }: FactsRuleProps) {
  const colors = useFactsColors();
  return (
    <View
      style={[
        styles.rule,
        { backgroundColor: colors.rule, marginHorizontal: -LABEL_PADDING },
        style,
      ]}
    />
  );
}

interface FactsRowProps {
  label: string;
  value?: ReactNode;
  valueColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function FactsRow({ label, value, valueColor, style }: FactsRowProps) {
  const colors = useFactsColors();
  return (
    <View style={[styles.row, style]}>
      <ThemedText weight="medium" type="bodySmall">
        {label}
      </ThemedText>
      {value !== undefined && (
        <>
          <ThemedText
            type="bodySmall"
            numberOfLines={1}
            ellipsizeMode="clip"
            style={[styles.dotLeader, { color: colors.muted }]}
          >
            {DOT_LEADER}
          </ThemedText>
          <ThemedText
            numberOfLines={2}
            type="bodySmall"
            style={[styles.rowValue, { color: valueColor ?? colors.ink }]}
          >
            {value}
          </ThemedText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    borderWidth: 2,
    padding: LABEL_PADDING,
    gap: 10,
  },
  headingWrap: {
    gap: 6,
  },
  heading: {},
  rule: {
    height: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  dotLeader: {
    flex: 1,
    overflow: "hidden",
    marginHorizontal: 8,
    letterSpacing: 2.5,
  },

  rowValue: {
    textAlign: "right",
    flexShrink: 1,
  },
});
