import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { useCameraPermissions, PermissionStatus } from "expo-camera";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import TapCameraIcon from "@/components/icons/tap-camera-icon";
import NoCameraIcon from "@/components/icons/no-camera-icon";
import ThemedButton from "@/components/ui/themed-button";

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const handleTap = () => {
    if (!permission?.granted) {
      requestPermission().then(() => {
        router.push("/(modals)/scan");
      });
      return;
    }

    router.push("/(modals)/scan");
  };

  if (permission && permission.status === PermissionStatus.GRANTED) {
    return (
      <TouchableOpacity
        style={[styles.container, { backgroundColor: colors.background }]}
        onPress={handleTap}
        activeOpacity={0.7}
      >
        <View
          style={[styles.placeholder, { borderColor: colors.primary[300] }]}
        >
          <TapCameraIcon color={colors.primary[300]} />
          <View style={{ alignItems: "center", gap: 4 }}>
            <ThemedText type="h2">Skip the Typing</ThemedText>
            <ThemedText
              type="bodyLarge"
              style={{ color: colors.primary[600], textAlign: "center" }}
            >
              Tap to snap your product's labels and we'll take it from there.
            </ThemedText>
          </View>
        </View>
        <ThemedText
          link
          type="captionSmall"
          style={{ color: colors.secondary[700] }}
          onPressWhenLink={() => router.push("/(modals)/add-product")}
        >
          Enter details manually instead
        </ThemedText>
      </TouchableOpacity>
    );
  }

  if (
    !permission ||
    (permission && permission.status !== PermissionStatus.GRANTED)
  ) {
    return (
      <TouchableOpacity
        style={[styles.container, { backgroundColor: colors.background }]}
        activeOpacity={0.7}
      >
        <View style={[styles.placeholder, { borderColor: colors.error }]}>
          <NoCameraIcon color={colors.error} />
          <View style={{ alignItems: "center", gap: 4 }}>
            <ThemedText type="h2">Camera Access Blocked</ThemedText>
            <ThemedText
              type="bodyLarge"
              style={{ color: colors.primary[600], textAlign: "center" }}
            >
              To scan your labels, enable camera access in your phone's
              Settings.{" "}
            </ThemedText>
          </View>
        </View>
        <ThemedButton
          text="Open Settings"
          onPress={() => {
            Linking.openSettings();
          }}
          alignment="center"
        />
        <ThemedText
          link
          type="captionSmall"
          style={{ color: colors.secondary[700] }}
          onPressWhenLink={() => router.push("/(modals)/add-product")}
        >
          Enter details manually instead
        </ThemedText>
      </TouchableOpacity>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 8,
  },
  placeholder: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 32,
    alignItems: "center",
    gap: 16,
    borderStyle: "dashed",
    borderWidth: 2,
  },
});
