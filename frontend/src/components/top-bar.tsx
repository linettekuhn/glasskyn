import { Colors, getTheme } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import UserAvatar from "@/components/ui/user-avatar";
import GlasskynLogo from "@/components/icons/glasskyn-logo";

export default function TopBar() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const { user } = useAuth();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.neutral[200],
        },
      ]}
    >
      <TouchableOpacity
        onPress={() => router.navigate("/(main)")}
        accessibilityLabel="Go to home"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <GlasskynLogo width={104} height={43} />
      </TouchableOpacity>

      <View style={styles.right}>
        <TouchableOpacity
          onPress={() => router.push("/(modals)/notifications")}
          accessibilityLabel="Notifications"
          style={styles.iconButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons
            name="bell-outline"
            size={26}
            color={colors.primary[700]}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.navigate("/(main)/profile")}
          accessibilityLabel="Profile"
          style={styles.avatar}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <UserAvatar seed={user?.name ?? "guest"} size={36} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
});
