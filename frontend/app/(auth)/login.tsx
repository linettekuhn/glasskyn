import { useState } from "react";
import {
  View,
  StyleSheet,
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
import Divider from "@/components/ui/divider";
import { Colors, getTheme } from "@/constants/theme";
import ThemedTextInput from "@/components/ui/themed-text-input";
import { MaterialIcons, Octicons } from "@expo/vector-icons";
import ThemedButton from "@/components/ui/themed-button";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const [showPass, setShowPass] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Toast.show({
        type: "error",
        text1: "Validation",
        text2: "Please fill in all fields",
      });
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/");
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
            <ThemedText type="h1">Welcome Back</ThemedText>
            <ThemedText
              type="bodyLarge"
              style={{ color: colors.secondary[600] }}
            >
              Sign in to your vanity
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
              {/* TOOD: implement forgot password functionality */}
              <ThemedText
                style={{ alignSelf: "flex-end", color: colors.secondary[700] }}
                type="caption"
                weight="medium"
              >
                Forgot password?
              </ThemedText>
            </View>
            <ThemedButton
              text="Sign in"
              onPress={handleLogin}
              disabled={loading}
              loading={loading}
              rightIconName="arrow-forward"
              RightIconComponent={MaterialIcons}
            />
          </View>
          <Divider color={colors.secondary[500]}>
            <ThemedText
              type="overline"
              style={{ paddingHorizontal: 16, color: colors.secondary[600] }}
            >
              or
            </ThemedText>
          </Divider>
          <View style={styles.link}>
            <ThemedText>Don't have an account?</ThemedText>
            <ThemedButton
              link
              onPress={() => router.push("/(auth)/register")}
              color={colors.secondary[700]}
              text="Register"
            />
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
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "center",
  },
});
