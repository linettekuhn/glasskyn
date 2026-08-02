import { View, StyleSheet, TouchableOpacity, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function NotificationsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top", "bottom"]}
    >
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.neutral[200] },
        ]}
      >
        <ThemedText type="h2">Notifications</ThemedText>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Close notifications"
          style={styles.closeButton}
        >
          <MaterialCommunityIcons
            name="close"
            size={24}
            color={colors.primary[700]}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.emptyState}>
        <MaterialCommunityIcons
          name="bell-outline"
          size={56}
          color={colors.neutral[400]}
        />
        <ThemedText type="bodyLarge" style={{ color: colors.neutral[600] }}>
          No notifications yet
        </ThemedText>
        <ThemedText
          type="bodySmall"
          style={{ color: colors.neutral[500], textAlign: "center" }}
        >
          We'll let you know when something needs your attention.
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
});
