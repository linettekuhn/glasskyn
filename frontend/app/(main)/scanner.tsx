import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useCameraPermissions } from "expo-camera";

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  const handleTap = () => {
    if (!permission?.granted) {
      requestPermission().then(() => {
        router.push("/(modals)/scan");
      });
      return;
    }

    router.push("/(modals)/scan");
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handleTap}
      activeOpacity={0.7}
    >
      <View style={styles.placeholder}>
        <Text style={styles.placeholderIcon}>📷</Text>
        <Text style={styles.placeholderTitle}>Tap to Scan</Text>
        <Text style={styles.placeholderSubtitle}>
          Take photos of your product labels
        </Text>
      </View>
      <Text style={styles.hint}>Camera activates when you tap</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  placeholder: {
    backgroundColor: "#2a2a2a",
    borderRadius: 20,
    padding: 40,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#6c63ff",
    borderStyle: "dashed",
  },
  placeholderIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  placeholderSubtitle: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
  },
  hint: {
    fontSize: 14,
    color: "#666",
    marginTop: 24,
  },
});
