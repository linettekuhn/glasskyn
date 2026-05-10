import { useState, useRef } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import Toast from "react-native-toast-message";
import { createProduct, updateProduct, lookupProduct } from "../../src/api/products";

export default function AddProductScreen() {
  const params = useLocalSearchParams<{
    editId?: string;
    name?: string;
    brand?: string;
    category?: string;
  }>();
  const editId = params.editId ? Number(params.editId) : null;

  const [permission, requestPermission] = useCameraPermissions();
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState(params.name ?? "");
  const [brand, setBrand] = useState(params.brand ?? "");
  const [category, setCategory] = useState(params.category ?? "");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const lastScanned = useRef<string | null>(null);

  const isEditing = editId !== null;

  const resetForm = () => {
    setName("");
    setBrand("");
    setCategory("");
    setBarcode("");
    lastScanned.current = null;
  };

  const doLookup = async (code: string) => {
    if (lastScanned.current === code) return;
    lastScanned.current = code;
    setBarcode(code);
    setLookupLoading(true);

    try {
      const result = await lookupProduct(code);
      setName(result.product_name || "");
      setBrand(result.brands || "");
      setCategory(result.categories || "");
      Toast.show({
        type: "success",
        text1: "Found",
        text2: result.product_name || "Product found",
        position: "top",
        visibilityTime: 2000,
      });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        Toast.show({
          type: "info",
          text1: "Not found",
          text2: "Fill in the details manually",
          position: "top",
          visibilityTime: 3000,
        });
      }
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Toast.show({
        type: "error",
        text1: "Validation",
        text2: "Product name is required",
        position: "top",
      });
      return;
    }

    setSubmitLoading(true);
    try {
      const data = {
        name: name.trim(),
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
      };

      if (isEditing) {
        await updateProduct(editId, data);
        Toast.show({
          type: "success",
          text1: "Updated",
          text2: `${name.trim()} saved`,
          position: "top",
        });
        router.back();
      } else {
        await createProduct(data);
        Toast.show({
          type: "success",
          text1: "Added",
          text2: `${name.trim()} saved`,
          position: "top",
        });
        resetForm();
      }
    } catch {
      // interceptor shows toast
    } finally {
      setSubmitLoading(false);
    }
  };

  const isLoading = lookupLoading || submitLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {permission?.granted ? (
          <CameraView
            style={styles.camera}
            onBarcodeScanned={(result) => doLookup(result.data)}
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "ean8", "upc_a", "code128", "code39"],
            }}
          />
        ) : (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionText}>
              Camera access needed for barcode scanning
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={() => requestPermission()}
            >
              <Text style={styles.permissionButtonText}>
                Grant Permission
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionTitle}>Barcode</Text>
        <View style={styles.barcodeRow}>
          <TextInput
            style={[styles.input, styles.barcodeInput]}
            placeholder="Scan or type barcode"
            placeholderTextColor="#999"
            value={barcode}
            onChangeText={setBarcode}
            keyboardType="number-pad"
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[styles.lookupButton, isLoading && styles.buttonDisabled]}
            onPress={() => doLookup(barcode)}
            disabled={isLoading || !barcode.trim()}
          >
            {lookupLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.lookupButtonText}>Lookup</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Product Details</Text>

        <TextInput
          style={styles.input}
          placeholder="Product name *"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
          editable={!isLoading}
        />

        <TextInput
          style={styles.input}
          placeholder="Brand (optional)"
          placeholderTextColor="#999"
          value={brand}
          onChangeText={setBrand}
          editable={!isLoading}
        />

        <TextInput
          style={styles.input}
          placeholder="Category (optional)"
          placeholderTextColor="#999"
          value={category}
          onChangeText={setCategory}
          editable={!isLoading}
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={resetForm}
            disabled={isLoading}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.addButton, isLoading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {submitLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.addButtonText}>{isEditing ? "Save" : "Add"}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      <Toast />
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
    paddingTop: 16,
  },
  camera: {
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  permissionBox: {
    height: 200,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    padding: 24,
  },
  permissionText: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },
  permissionButton: {
    backgroundColor: "#6c63ff",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  barcodeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  barcodeInput: {
    flex: 1,
    marginBottom: 0,
  },
  lookupButton: {
    backgroundColor: "#6c63ff",
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  lookupButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: "#fafafa",
    color: "#1a1a1a",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  clearButton: {
    backgroundColor: "#f0f0f0",
  },
  clearButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  addButton: {
    backgroundColor: "#6c63ff",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
