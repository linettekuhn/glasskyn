import { ReactNode } from "react";
import {
  StyleProp,
  StyleSheet,
  useColorScheme,
  View,
  ViewStyle,
} from "react-native";
import { Colors, getTheme } from "@/constants/theme";

interface DividerProps {
  children?: ReactNode;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export default function Divider({ children, color, style }: DividerProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const lineColor = color ?? colors.neutral[300];

  if (!children) {
    return (
      <View style={[styles.line, { backgroundColor: lineColor }, style]} />
    );
  }

  return (
    <View style={[styles.row, style]}>
      <View style={[styles.line, { backgroundColor: lineColor }]} />
      {children}
      <View style={[styles.line, { backgroundColor: lineColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  line: {
    flex: 1,
    height: 1,
    alignSelf: "stretch",
  },
});
