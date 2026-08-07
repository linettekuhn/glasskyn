import { router } from "expo-router";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";

export default function EntryCards() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const entries = [
    {
      key: "chat",
      icon: "chat-processing-outline" as const,
      title: "Ask Cur.ai",
      subtext: "Personalized guidance based on your vanity",
      onPress: () => router.navigate("/(main)/chat"),
    },
    {
      key: "scan",
      icon: "camera-outline" as const,
      title: "Scan a product",
      subtext: "Add it to your vanity in seconds",
      onPress: () => router.navigate("/(main)/scanner"),
    },
  ];

  return (
    <View style={styles.row}>
      {entries.map((entry) => (
        <TouchableOpacity
          key={entry.key}
          style={[
            styles.card,
            {
              backgroundColor: colors.background,
              borderColor: colors.neutral[200],
            },
          ]}
          activeOpacity={0.7}
          onPress={entry.onPress}
        >
          <View style={[styles.icon, { backgroundColor: colors.primary[100] }]}>
            <MaterialCommunityIcons
              name={entry.icon}
              size={24}
              color={colors.primary[600]}
            />
          </View>
          <ThemedText type="bodyLarge" weight="semiBold" numberOfLines={1}>
            {entry.title}
          </ThemedText>
          <ThemedText type="caption" style={{ color: colors.neutral[600] }}>
            {entry.subtext}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
  },
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    position: "relative",
  },
  icon: {
    position: "absolute",
    right: -8,
    top: -12,
    padding: 8,
    borderRadius: 9999,
  },
});
