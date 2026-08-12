import { useEffect } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Linking,
  AppState,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useCameraPermissions, PermissionStatus } from "expo-camera";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import TapCameraIcon from "@/components/icons/tap-camera-icon";
import NoCameraIcon from "@/components/icons/no-camera-icon";
import ThemedButton from "@/components/ui/themed-button";

export default function ScannerScreen() {
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        getPermission();
      }
    });
    return () => sub.remove();
  }, [getPermission]);

  const handleTap = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (res?.granted) router.push("/(modals)/scan");
      return;
    }

    router.push("/(modals)/scan");
  };

  const handleRequest = async () => {
    await requestPermission();
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.primary[600]} />
      </View>
    );
  }

  if (permission.status === PermissionStatus.GRANTED) {
    return (
      <TouchableOpacity
        style={styles.container}
        onPress={handleTap}
        activeOpacity={0.7}
      >
        <View
          style={[styles.placeholder, { borderColor: colors.primary[400] }]}
        >
          <TapCameraIcon color={colors.primary[500]} />
          <View style={{ alignItems: "center", gap: 4 }}>
            <ThemedText type="h2">Skip the Typing</ThemedText>
            <ThemedText
              type="bodyLarge"
              style={{ color: colors.neutral[500], textAlign: "center" }}
            >
              Tap to snap your product's labels and we'll take it from there.
            </ThemedText>
          </View>
        </View>
        <ThemedButton
          link
          textType="captionSmall"
          onPress={() => router.push("/(modals)/add-product")}
          color={colors.secondary[700]}
          text={"Enter details manually instead"}
        />
      </TouchableOpacity>
    );
  }

  if (permission.status === PermissionStatus.UNDETERMINED) {
    return (
      <TouchableOpacity
        style={styles.container}
        onPress={handleRequest}
        activeOpacity={0.7}
      >
        <View
          style={[styles.placeholder, { borderColor: colors.primary[400] }]}
        >
          <TapCameraIcon color={colors.primary[500]} />
          <View style={{ alignItems: "center", gap: 4 }}>
            <ThemedText type="h2">Camera Access Needed</ThemedText>
            <ThemedText
              type="bodyLarge"
              style={{ color: colors.neutral[500], textAlign: "center" }}
            >
              Allow camera access to scan your product labels.
            </ThemedText>
          </View>
        </View>
        <ThemedButton
          text="Allow Camera Access"
          onPress={handleRequest}
          alignment="center"
        />
        <ThemedButton
          link
          textType="captionSmall"
          onPress={() => router.push("/(modals)/add-product")}
          color={colors.secondary[700]}
          text={"Enter details manually instead"}
        />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.container} activeOpacity={0.7}>
      <View style={[styles.placeholder, { borderColor: colors.error }]}>
        <NoCameraIcon color={colors.error} />
        <View style={{ alignItems: "center", gap: 4 }}>
          <ThemedText type="h2">Camera Access Blocked</ThemedText>
          <ThemedText
            type="bodyLarge"
            style={{ color: colors.neutral[500], textAlign: "center" }}
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
      <ThemedButton
        link
        textType="captionSmall"
        onPress={() => router.push("/(modals)/add-product")}
        color={colors.secondary[700]}
        text={"Enter details manually instead"}
      />
    </TouchableOpacity>
  );
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
