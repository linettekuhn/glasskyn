import { View, StyleSheet, useColorScheme } from "react-native";
import { ThemedText } from "@/components/ui/themed-text";
import { Colors, getTheme } from "@/constants/theme";

export default function BrowseTemplatesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  return (
    <View style={[styles.container, { backgroundColor: colors.neutral[100] }]}>
      <ThemedText type="h1">Browse Templates</ThemedText>
      <ThemedText type="bodyLarge" style={{ color: colors.secondary[600] }}>
        Template browsing coming soon
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 80,
    gap: 16,
  },
});
