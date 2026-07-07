import { View, StyleSheet, useColorScheme } from "react-native";
import { ThemedText } from "@/components/ui/themed-text";
import { Colors, getTheme } from "@/constants/theme";

export default function RoutineScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  return (
    <View style={[styles.container, { backgroundColor: colors.neutral[100] }]}>
      <View style={styles.content}>
        <ThemedText type="h1">My Routine</ThemedText>
        <ThemedText type="bodyLarge" style={{ color: colors.secondary[600] }}>
          Your personalized skincare routine will appear here.
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 80,
    gap: 16,
  },
});
