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
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import Toast from "react-native-toast-message";
import {
  createProduct,
  updateProduct,
  lookupProduct,
} from "../../src/api/products";
import { ProductCategory } from "../../src/types";

export default function AddProductScreen() {
  const params = useLocalSearchParams<{
    editId?: string;
    name?: string;
    brand?: string;
    category?: string;
    barcode?: string;
    imageUrl?: string;
    imageS3Key?: string;
    scanId?: string;
    paoMonths?: string;
  }>();
  const editId = params.editId ? Number(params.editId) : null;

  const [permission, requestPermission] = useCameraPermissions();
  const [barcode, setBarcode] = useState(params.barcode ?? "");
  const [name, setName] = useState(params.name ?? "");
  const [brand, setBrand] = useState(params.brand ?? "");
  const [category, setCategory] = useState<ProductCategory | "">(
    (params.category as ProductCategory) || ""
  );
  const [imageUrl, setImageUrl] = useState(params.imageUrl ?? "");
  const [imageS3Key, setImageS3Key] = useState(params.imageS3Key ?? "");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [isBarcodeScannerActive, setIsBarcodeScannerActive] = useState(false);
  const lastScanned = useRef<string | null>(null);
  const hasProcessedBarcode = useRef(false);

  const isEditing = editId !== null;

  const handleActivateBarcodeScanner = () => {
    if (isBarcodeScannerActive) return;
    hasProcessedBarcode.current = false;
    setIsBarcodeScannerActive(true);
  };

  const handleBarcodeScanned = (result: { data: string }) => {
    console.log("[DEBUG] Barcode detected:", result.data);
    // Block all subsequent calls once first barcode is detected
    if (hasProcessedBarcode.current) {
      console.log("[DEBUG] Already processing barcode, skipping");
      return;
    }
    hasProcessedBarcode.current = true;
    setIsBarcodeScannerActive(false);

    if (lastScanned.current === result.data) {
      console.log("[DEBUG] Duplicate barcode, skipping");
      return;
    }
    console.log("[DEBUG] Calling doLookup with:", result.data);
    doLookup(result.data);
  };

  const resetForm = () => {
    setName("");
    setBrand("");
    setCategory("");
    setBarcode("");
    setImageUrl("");
    setImageS3Key("");
    lastScanned.current = null;
  };

  const CATEGORIES: ProductCategory[] = ["skincare", "makeup", "haircare"];

  const normalizeCategory = (cat: string | null): ProductCategory | "" => {
    if (!cat) return "";
    const normalized = cat.toLowerCase().trim();
    if (CATEGORIES.includes(normalized as ProductCategory)) {
      return normalized as ProductCategory;
    }
    return "";
  };

  const doLookup = async (code: string) => {
    console.log("[DEBUG] doLookup started with code:", code);
    // Set lastScanned FIRST to prevent race conditions with duplicate detections
    lastScanned.current = code;
    setBarcode(code);
    setLookupLoading(true);
    console.log("[DEBUG] Calling lookupProduct API...");

    try {
      const result = await lookupProduct(code);
      console.log("[DEBUG] lookupProduct result:", result);
      setName(result.product_name || "");
      setBrand(result.brands || "");
      setCategory(normalizeCategory(result.categories));
      console.log("[DEBUG] Product found, fields populated");
      Toast.show({
        type: "success",
        text1: "Found",
        text2: result.product_name || "Product found",
        position: "top",
        visibilityTime: 2000,
      });
    } catch (err: any) {
      console.log(
        "[DEBUG] lookupProduct failed:",
        err?.response?.status || err.message,
      );
      if (err?.response?.status === 404) {
        console.log("[DEBUG] Product not found in Open Beauty Facts");
        Toast.show({
          type: "info",
          text1: "Not found",
          text2: "Fill in the details manually",
          position: "top",
          visibilityTime: 3000,
        });
      }
    } finally {
      console.log("[DEBUG] doLookup completed");
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
      const data: Parameters<typeof createProduct>[0] = {
        name: name.trim(),
        brand: brand.trim() || undefined,
        category: category || undefined,
        image_s3_key: imageS3Key || undefined,
      };

      const scanId = params.scanId ? Number(params.scanId) : null;
      if (!isEditing && scanId) {
        data.scan_id = scanId;
      }

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
        router.replace("/(main)/products");
      }
    } catch {
      // interceptor shows toast
    } finally {
      setSubmitLoading(false);
    }
  };

  const isLoading = lookupLoading || submitLoading;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.containerInner}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={[styles.button]}
            onPress={() => router.back()}
          >
            <Text>Back</Text>
          </TouchableOpacity>
          {!isEditing &&
            (isBarcodeScannerActive && permission?.granted ? (
              <CameraView
                style={styles.camera}
                onBarcodeScanned={handleBarcodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ["ean13", "ean8", "upc_a", "code128", "code39"],
                }}
              />
            ) : permission?.granted ? (
              <TouchableOpacity
                style={styles.cameraPlaceholder}
                onPress={handleActivateBarcodeScanner}
                activeOpacity={0.7}
              >
                <Text style={styles.cameraPlaceholderIcon}>📷</Text>
                <Text style={styles.cameraPlaceholderTitle}>
                  Tap to Scan Barcode
                </Text>
                <Text style={styles.cameraPlaceholderSubtitle}>
                  Opens camera briefly to scan
                </Text>
              </TouchableOpacity>
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
            ))}

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

          {imageUrl ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => {
                  setImageUrl("");
                  setImageS3Key("");
                }}
              >
                <Text style={styles.removeImageText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : null}

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

          <Text style={styles.sectionTitle}>Category</Text>
          <View style={styles.segmentedControl}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.segmentButton,
                  category === cat && styles.segmentButtonActive,
                ]}
                onPress={() => setCategory(category === cat ? "" : cat)}
                disabled={isLoading}
              >
                <Text
                  style={[
                    styles.segmentButtonText,
                    category === cat && styles.segmentButtonTextActive,
                  ]}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.clearButton]}
              onPress={() => (isEditing ? router.back() : resetForm())}
              disabled={isLoading}
            >
              <Text style={styles.clearButtonText}>
                {isEditing ? "Cancel" : "Clear"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.addButton,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {submitLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.addButtonText}>
                  {isEditing ? "Save" : "Add"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
        <Toast />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  containerInner: {
    flex: 1,
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
  cameraPlaceholder: {
    height: 200,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#ddd",
    borderStyle: "dashed",
  },
  cameraPlaceholderIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  cameraPlaceholderTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  cameraPlaceholderSubtitle: {
    fontSize: 14,
    color: "#888",
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
  imagePreviewContainer: {
    position: "relative",
    marginBottom: 16,
  },
  imagePreview: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
  },
  removeImageButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  removeImageText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  segmentedControl: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fafafa",
    alignItems: "center",
  },
  segmentButtonActive: {
    backgroundColor: "#6c63ff",
    borderColor: "#6c63ff",
  },
  segmentButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    textTransform: "capitalize",
  },
  segmentButtonTextActive: {
    color: "#fff",
  },
});
