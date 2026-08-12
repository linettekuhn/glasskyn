import { useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Pressable,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import { MaterialCommunityIcons, Octicons } from "@expo/vector-icons";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedTextInput from "@/components/ui/themed-text-input";
import ThemedButton from "@/components/ui/themed-button";
import { changePassword as changePasswordApi } from "@/api/auth";

export default function ChangePasswordScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showNext, setShowNext] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!current || !next || !confirm) {
      Toast.show({
        type: "error",
        text1: "Validation",
        text2: "Please fill in all fields",
        position: "top",
      });
      return;
    }
    if (next.length < 6) {
      Toast.show({
        type: "error",
        text1: "Validation",
        text2: "New password must be at least 6 characters",
        position: "top",
      });
      return;
    }
    if (next !== confirm) {
      Toast.show({
        type: "error",
        text1: "Validation",
        text2: "New passwords do not match",
        position: "top",
      });
      return;
    }

    setSaving(true);
    try {
      await changePasswordApi(current, next);
      Toast.show({
        type: "success",
        text1: "Saved",
        text2: "Password updated",
        position: "top",
      });
      router.back();
    } catch {
      // interceptor shows toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.neutral[200] }]}>
        <ThemedText type="h2">Change Password</ThemedText>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Close change password"
          style={styles.closeButton}
        >
          <MaterialCommunityIcons
            name="close"
            size={24}
            color={colors.primary[700]}
          />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <ThemedText type="bodySmall" style={{ color: colors.neutral[600] }}>
            You'll be signed out on all devices after updating your password.
          </ThemedText>

          <View style={styles.field}>
            <ThemedText type="bodySmall" style={{ color: colors.neutral[600] }}>
              Current password
            </ThemedText>
            <ThemedTextInput
              value={current}
              onChangeText={setCurrent}
              placeholder="* * * * * *"
              secureTextEntry
              autoCapitalize="none"
              IconComponent={MaterialCommunityIcons}
              iconName="lock-outline"
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="bodySmall" style={{ color: colors.neutral[600] }}>
              New password
            </ThemedText>
            <ThemedTextInput
              value={next}
              onChangeText={setNext}
              placeholder="* * * * * *"
              secureTextEntry={!showNext}
              autoCapitalize="none"
              IconComponent={MaterialCommunityIcons}
              iconName="lock-reset"
            >
              <Pressable
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={() => setShowNext((prev) => !prev)}
              >
                {showNext ? (
                  <Octicons
                    name="eye-closed"
                    size={20}
                    color={colors.neutral[400]}
                  />
                ) : (
                  <Octicons name="eye" size={20} color={colors.neutral[400]} />
                )}
              </Pressable>
            </ThemedTextInput>
          </View>

          <View style={styles.field}>
            <ThemedText type="bodySmall" style={{ color: colors.neutral[600] }}>
              Confirm new password
            </ThemedText>
            <ThemedTextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="* * * * * *"
              secureTextEntry
              autoCapitalize="none"
              IconComponent={MaterialCommunityIcons}
              iconName="lock-check-outline"
            />
          </View>

          <ThemedButton
            text="Update Password"
            onPress={handleSave}
            loading={saving}
            color={colors.primary[600]}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
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
  content: {
    padding: 24,
    gap: 20,
  },
  field: {
    gap: 8,
  },
});
