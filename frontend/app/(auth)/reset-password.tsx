import { useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
  TouchableWithoutFeedback,
  Keyboard,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import {
  MaterialCommunityIcons,
  MaterialIcons,
  Octicons,
} from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/themed-text";
import { Colors, getTheme } from "@/constants/theme";
import ThemedTextInput from "@/components/ui/themed-text-input";
import ThemedButton from "@/components/ui/themed-button";
import { resetPassword } from "@/api/auth";

export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const router = useRouter();

  const handleReset = async () => {
    if (!code || !password || !confirm) {
      Toast.show({
        type: "error",
        text1: "Validation",
        text2: "Please fill in all fields",
      });
      return;
    }
    if (code.length !== 6) {
      Toast.show({
        type: "error",
        text1: "Validation",
        text2: "Your reset code is 6 digits",
      });
      return;
    }
    if (password.length < 6) {
      Toast.show({
        type: "error",
        text1: "Validation",
        text2: "Password must be at least 6 characters",
      });
      return;
    }
    if (password !== confirm) {
      Toast.show({
        type: "error",
        text1: "Validation",
        text2: "Passwords do not match",
      });
      return;
    }
    setLoading(true);
    try {
      await resetPassword(code, password);
      Toast.show({
        type: "success",
        text1: "Password reset",
        text2: "Sign in with your new password",
      });
      router.replace("/(auth)/login");
    } catch {
      // toast already shown by axios interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.content}>
            <ThemedButton
              link
              text="Go Back"
              leftIconName="arrow-back"
              LeftIconComponent={MaterialIcons}
              onPress={() => router.back()}
              color={colors.neutral[800]}
              alignment="flex-start"
            />
            <View style={styles.heading}>
              <ThemedText type="h1">Reset password</ThemedText>
              {email ? (
                <ThemedText
                  type="bodyLarge"
                  style={{ color: colors.neutral[600], textAlign: "center" }}
                >
                  Enter the 6-digit code sent to{"\n"}
                  <ThemedText type="bodyLarge" weight="medium">
                    {email}
                  </ThemedText>
                </ThemedText>
              ) : (
                <ThemedText
                  type="bodyLarge"
                  style={{ color: colors.neutral[600], textAlign: "center" }}
                >
                  Enter the 6-digit code sent to your email, then choose a new
                  password.
                </ThemedText>
              )}
            </View>
            <View style={styles.form}>
              <View style={styles.inputWrapper}>
                <ThemedText type="caption" weight="medium">
                  Reset code
                </ThemedText>
                <ThemedTextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="0 0 0 0 0 0"
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!loading}
                />
              </View>
              <View style={styles.inputWrapper}>
                <ThemedText type="caption" weight="medium">
                  New password
                </ThemedText>
                <ThemedTextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="* * *"
                  editable={!loading}
                  secureTextEntry={!showPass}
                >
                  <Pressable
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => setShowPass((prev) => !prev)}
                  >
                    {showPass ? (
                      <Octicons
                        name="eye-closed"
                        size={20}
                        color={colors.neutral[400]}
                      />
                    ) : (
                      <Octicons
                        name="eye"
                        size={20}
                        color={colors.neutral[400]}
                      />
                    )}
                  </Pressable>
                </ThemedTextInput>
              </View>
              <View style={styles.inputWrapper}>
                <ThemedText type="caption" weight="medium">
                  Confirm new password
                </ThemedText>
                <ThemedTextInput
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="* * *"
                  editable={!loading}
                  secureTextEntry
                />
              </View>
              <ThemedButton
                text="Reset password"
                onPress={handleReset}
                disabled={loading}
                loading={loading}
              />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  content: {
    paddingHorizontal: 32,
    gap: 32,
  },
  backButton: {
    alignSelf: "flex-start",
  },
  heading: {
    alignItems: "center",
    gap: 8,
  },
  inputWrapper: {
    gap: 8,
  },
  form: {
    gap: 24,
  },
});
