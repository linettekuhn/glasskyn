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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedTextInput from "@/components/ui/themed-text-input";
import ThemedButton from "@/components/ui/themed-button";
import { useAuth } from "@/contexts/AuthContext";

export default function DeleteAccountScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const { deleteAccount } = useAuth();

  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!password) {
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(password);
      router.replace("/(auth)/login");
    } catch {
      // interceptor shows toast
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.neutral[200] }]}>
        <ThemedText type="h2">Delete Account</ThemedText>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Close delete account"
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
          <ThemedText type="bodySmall" style={{ color: colors.error }}>
            This permanently deletes your account and all of your data. This
            cannot be undone.
          </ThemedText>

          <View style={styles.field}>
            <ThemedText type="bodySmall" style={{ color: colors.neutral[600] }}>
              Enter your password to confirm
            </ThemedText>
            <ThemedTextInput
              value={password}
              onChangeText={setPassword}
              placeholder="* * * * * *"
              secureTextEntry
              autoCapitalize="none"
              IconComponent={MaterialCommunityIcons}
              iconName="lock-outline"
            />
          </View>

          <ThemedButton
            text="Delete Account"
            onPress={handleDelete}
            loading={deleting}
            color={colors.error}
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