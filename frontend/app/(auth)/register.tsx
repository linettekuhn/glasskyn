import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
  Pressable,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import Toast from "react-native-toast-message";
import { ThemedText } from "@/components/ui/themed-text";
import { Colors, getTheme } from "@/constants/theme";
import ThemedTextInput from "@/components/ui/themed-text-input";
import { Octicons } from "@expo/vector-icons";
import ThemedButton from "@/components/ui/themed-button";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const [showPass, setShowPass] = useState(false);
  const router = useRouter();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Toast.show({
        type: "error",
        text1: "Validation",
        text2: "Please fill in all fields",
      });
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password);
      router.replace("/(main)");
    } catch {
      // toast already shown by axios interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.neutral[100] }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.content}>
          <View style={styles.heading}>
            <ThemedText type="h1">Create your shelf</ThemedText>
            <ThemedText
              type="bodyLarge"
              style={{ color: colors.secondary[600] }}
            >
              Keep your cosmetics fresh and effective.
            </ThemedText>
          </View>
          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <ThemedText type="caption" weight="medium">
                Name
              </ThemedText>
              <ThemedTextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter your full name"
                autoCapitalize="words"
                editable={!loading}
              />
            </View>
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
            <View style={styles.inputWrapper}>
              <ThemedText type="caption" weight="medium">
                Password
              </ThemedText>
              <ThemedTextInput
                placeholder="* * *"
                value={password}
                onChangeText={setPassword}
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
                      color={colors.primary[500]}
                    />
                  ) : (
                    <Octicons
                      name="eye"
                      size={20}
                      color={colors.primary[500]}
                    />
                  )}
                </Pressable>
              </ThemedTextInput>
            </View>
            <ThemedButton
              text="Create Account"
              onPress={handleRegister}
              disabled={loading}
              loading={loading}
              RightIconComponent={Octicons}
              rightIconName="arrow-right"
            />
          </View>
          <View style={styles.divider}>
            <View
              style={[styles.line, { backgroundColor: colors.secondary[500] }]}
            />
            <ThemedText
              type="overline"
              style={{ paddingHorizontal: 16, color: colors.secondary[600] }}
            >
              or
            </ThemedText>
            <View
              style={[styles.line, { backgroundColor: colors.secondary[500] }]}
            />
          </View>
          <View style={styles.link}>
            <ThemedText>Already have an account?</ThemedText>
            <ThemedText
              link
              style={{ color: colors.secondary[700] }}
              onPressWhenLink={() => router.push("/(auth)/login")}
            >
              Log in
            </ThemedText>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 32,
    gap: 32,
  },
  heading: {
    alignItems: "center",
  },
  inputWrapper: {
    gap: 8,
  },
  form: {
    gap: 24,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  line: {
    flex: 1,
    height: 1,
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "center",
  },
});
