import { useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedTextInput from "@/components/ui/themed-text-input";
import ThemedButton from "@/components/ui/themed-button";
import { useAuth } from "@/contexts/AuthContext";
import { updateUser as updateUserApi } from "@/api/auth";
import { capitalizeWords } from "@/utils/capitalize";

export default function EditAccountScreen() {
  const { user, updateUser } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Toast.show({
        type: "error",
        text1: "Validation",
        text2: "Name is required",
        position: "top",
      });
      return;
    }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      Toast.show({
        type: "error",
        text1: "Validation",
        text2: "Enter a valid email address",
        position: "top",
      });
      return;
    }

    setSaving(true);
    try {
      const updated = await updateUserApi({
        name: capitalizeWords(name.trim()),
        email: email.trim(),
      });
      updateUser(updated);
      Toast.show({
        type: "success",
        text1: "Saved",
        text2: "Account details updated",
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
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top", "bottom"]}
    >
      <View
        style={[styles.header, { borderBottomColor: colors.neutral[200] }]}
      >
        <ThemedText type="h2">Edit Account</ThemedText>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Close edit account"
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
          <View style={styles.field}>
            <ThemedText type="bodySmall" style={{ color: colors.neutral[600] }}>
              Name
            </ThemedText>
            <ThemedTextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoCapitalize="words"
              autoCorrect={false}
              IconComponent={MaterialCommunityIcons}
              iconName="account-outline"
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="bodySmall" style={{ color: colors.neutral[600] }}>
              Email
            </ThemedText>
            <ThemedTextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              IconComponent={MaterialCommunityIcons}
              iconName="email-outline"
            />
          </View>

          <ThemedButton
            text="Save"
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
