import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import { createProduct } from "../../src/api/products";

export default function AddProductScreen() {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Toast.show({
        type: "error",
        text1: "Validation",
        text2: "Product name is required",
      });
      return;
    }

    setLoading(true);
    try {
      await createProduct({
        name: name.trim(),
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
      });

      Toast.show({
        type: "success",
        text1: "Success",
        text2: `${name.trim()} added`,
      });
      router.back();
    } catch {
      // toast already shown by axios interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          style={styles.input}
          placeholder="Product name *"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
          autoFocus
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Brand (optional)"
          placeholderTextColor="#999"
          value={brand}
          onChangeText={setBrand}
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Category (optional)"
          placeholderTextColor="#999"
          value={category}
          onChangeText={setCategory}
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Add Product</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    padding: 24,
    paddingTop: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: "#fafafa",
    color: "#1a1a1a",
  },
  button: {
    backgroundColor: "#6c63ff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
