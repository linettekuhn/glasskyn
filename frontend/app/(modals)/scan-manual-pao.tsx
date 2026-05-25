import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import { useScanContext } from "../../src/contexts/ScanContext";

function normalizePao(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/(\d+)/);
  if (!match) return null;

  const months = parseInt(match[1], 10);
  if (months < 1 || months > 120) return null;

  return months;
}

export default function ScanManualPaoScreen() {
  const { setPaoMonths } = useScanContext();
  const [text, setText] = useState("");

  const handleSubmit = () => {
    const months = normalizePao(text);
    if (months === null) {
      Toast.show({
        type: "error",
        text1: "Invalid value",
        text2: "Enter a number like 12M, 6, or 24 months",
        position: "top",
      });
      return;
    }

    setPaoMonths(months);
    router.replace("/(modals)/scan-confirm");
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Enter PAO Value</Text>
          <Text style={styles.subtitle}>
            How many months after opening is this product good for?
          </Text>

          <TextInput
            style={styles.input}
            placeholder="e.g. 12M, 6, 24 months"
            placeholderTextColor="#999"
            value={text}
            onChangeText={setText}
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.hint}>
            Examples: 12M, 6, 24 months, 12 mois
          </Text>

          <TouchableOpacity
            style={[styles.submitButton, !text.trim() && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!text.trim()}
          >
            <Text style={styles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  inner: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: "center" },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    fontSize: 20,
    backgroundColor: "#fafafa",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 8,
  },
  hint: { fontSize: 13, color: "#999", textAlign: "center", marginBottom: 32 },
  submitButton: {
    backgroundColor: "#6c63ff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  buttonDisabled: { opacity: 0.5 },
});
