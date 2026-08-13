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
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/themed-text";
import { Colors, getTheme } from "@/constants/theme";
import ThemedTextInput from "@/components/ui/themed-text-input";
import ThemedButton from "@/components/ui/themed-button";
import { forgotPassword } from "@/api/auth";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const router = useRouter();

  const handleSend = async () => {
    if (!email) {
      Toast.show({
        type: "error",
        text1: "Validation",
        text2: "Please enter your email",
      });
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(email);
      Toast.show({
        type: "success",
        text1: "Check your email",
        text2: "If that account exists, a reset code is on its way.",
      });
      router.push({
        pathname: "/(auth)/reset-password",
        params: { email },
      });
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
              <ThemedText type="h1">Forgot password</ThemedText>
              <ThemedText
                type="bodyLarge"
                style={{ color: colors.neutral[600], textAlign: "center" }}
              >
                Enter your email and we'll send you a code to reset your
                password.
              </ThemedText>
            </View>
            <View style={styles.form}>
              <View style={styles.inputWrapper}>
                <ThemedText type="caption" weight="medium">
                  Email
                </ThemedText>
                <ThemedTextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="hello@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>
              <ThemedButton
                text="Send reset code"
                onPress={handleSend}
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
