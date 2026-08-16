import { useState, useCallback, ComponentProps } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useColorScheme,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../src/contexts/AuthContext";
import NotificationSettings from "../../src/components/ui/notification-settings";
import HomeRoutineSetting from "../../src/components/ui/home-routine-setting";
import UnitsSetting from "../../src/components/ui/units-setting";
import { getSkinProfile } from "../../src/api/routines";
import type { SkinProfile } from "../../src/types";
import { Colors, getTheme } from "../../src/constants/theme";
import { ThemedText } from "../../src/components/ui/themed-text";
import UserAvatar from "../../src/components/ui/user-avatar";
import ThemedButton from "@/components/ui/themed-button";
import GlassSurface from "@/components/ui/glass-surface";

const SKIN_TYPE_LABELS: Record<string, string> = {
  dry: "Dry",
  oily: "Oily",
  combination: "Combination",
  normal: "Normal",
  sensitive: "Sensitive",
};

function skinTypeLabel(value: string | null | undefined): string {
  if (!value) return "Not set";
  return SKIN_TYPE_LABELS[value] ?? value;
}

type SettingsRowProps = {
  label: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  destructive?: boolean;
  last?: boolean;
  onPress: () => void;
};

function SettingsRow({
  label,
  icon,
  destructive,
  last,
  onPress,
}: SettingsRowProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const tint = destructive ? colors.error : colors.primary[700];

  return (
    <TouchableOpacity
      style={[
        styles.settingsRow,
        !last && { borderBottomColor: colors.neutral[200] },
        last && { borderBottomColor: "transparent" },
      ]}
      onPress={onPress}
    >
      <MaterialCommunityIcons name={icon} size={22} color={tint} />
      <ThemedText
        type="body"
        style={{ flex: 1, color: destructive ? colors.error : colors.text }}
      >
        {label}
      </ThemedText>
      <MaterialCommunityIcons
        name="chevron-right"
        size={22}
        color={colors.neutral[400]}
      />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { user, logout, deleteAccount } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const [skinProfile, setSkinProfile] = useState<SkinProfile | null>(null);
  const [showHomeRoutine, setShowHomeRoutine] = useState(false);

  const fetchSkinProfile = useCallback(() => {
    getSkinProfile()
      .then(setSkinProfile)
      .catch(() => setSkinProfile(null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSkinProfile();
    }, [fetchSkinProfile]),
  );

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This permanently deletes your account and all of your data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
              router.replace("/(auth)/login");
            } catch {
              // interceptor shows toast
            }
          },
        },
      ],
    );
  };

  const hasSkinProfile =
    skinProfile !== null &&
    (skinProfile.skin_type !== null || skinProfile.concerns.length > 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <UserAvatar seed={user?.name ?? "guest"} size={80} />
          <ThemedText type="h2">{user?.name ?? "Profile"}</ThemedText>
          <ThemedText type="bodySmall" style={{ color: colors.neutral[600] }}>
            {user?.email}
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="overline" style={{ color: colors.neutral[600] }}>
            Account
          </ThemedText>
          <GlassSurface style={styles.card}>
            <SettingsRow
              label="Edit name & email"
              icon="account-edit-outline"
              onPress={() => router.push("/(modals)/edit-account")}
            />
            <SettingsRow
              label="Change password"
              icon="lock-outline"
              onPress={() => router.push("/(modals)/change-password")}
            />
            <SettingsRow
              label="Delete account"
              icon="delete-outline"
              destructive
              last
              onPress={handleDeleteAccount}
            />
          </GlassSurface>
        </View>

        <View style={styles.section}>
          <ThemedText type="overline" style={{ color: colors.neutral[600] }}>
            Skin Profile
          </ThemedText>
          <GlassSurface
            style={styles.card}
            onPress={() => router.push("/(modals)/edit-skin-profile")}
          >
            <View style={styles.skinRow}>
              <View style={styles.skinInfo}>
                {hasSkinProfile ? (
                  <>
                    <ThemedText type="bodyLarge" weight="semiBold">
                      {skinTypeLabel(skinProfile?.skin_type)}
                      {skinProfile?.is_sensitive != null
                        ? ` · ${skinProfile.is_sensitive ? "Sensitive" : "Not sensitive"}`
                        : ""}
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      style={{ color: colors.neutral[600] }}
                    >
                      {`${skinProfile?.concerns?.length ?? 0} concern${(skinProfile?.concerns?.length ?? 0) === 1 ? "" : "s"} · ${skinProfile?.goals?.length ?? 0} goal${(skinProfile?.goals?.length ?? 0) === 1 ? "" : "s"}`}
                    </ThemedText>
                  </>
                ) : (
                  <>
                    <ThemedText type="bodyLarge" weight="semiBold">
                      Set up your skin profile
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      style={{ color: colors.neutral[600] }}
                    >
                      Tailor routines and ingredient flags to your skin
                    </ThemedText>
                  </>
                )}
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color={colors.neutral[400]}
              />
            </View>
          </GlassSurface>
        </View>

        {showHomeRoutine && (
          <View style={styles.section}>
            <ThemedText type="overline" style={{ color: colors.neutral[600] }}>
              Home Screen
            </ThemedText>
            <HomeRoutineSetting onReady={setShowHomeRoutine} />
          </View>
        )}

        <View style={styles.section}>
          <ThemedText type="overline" style={{ color: colors.neutral[600] }}>
            Units
          </ThemedText>
          <UnitsSetting />
        </View>

        <View style={styles.section}>
          <ThemedText type="overline" style={{ color: colors.neutral[600] }}>
            Reminders
          </ThemedText>
          <NotificationSettings />
        </View>

        <ThemedButton
          onPress={handleLogout}
          link
          text="Logout"
          leftIconName="logout"
          LeftIconComponent={MaterialCommunityIcons}
          color={colors.error}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    gap: 24,
  },
  header: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  section: {
    gap: 10,
  },
  card: {
    borderRadius: 12,
    overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
  },
  skinRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    gap: 12,
  },
  skinInfo: {
    flex: 1,
    gap: 2,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    padding: 16,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  version: {
    textAlign: "center",
    fontSize: 13,
    paddingBottom: 8,
  },
});
