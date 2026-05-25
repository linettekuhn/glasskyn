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
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import { createProduct, updateScanResult } from "../../src/api/products";
import { ProductCategory, NameBrandMethod } from "../../src/types";
import { useScanContext } from "../../src/contexts/ScanContext";

const CATEGORIES: ProductCategory[] = ["skincare", "makeup", "haircare"];

function formatPao(months: number | null): string {
  if (months === null || months === undefined) return "Not found";
  return `${months} months`;
}

export default function ScanConfirmScreen() {
  const { scanResult, paoMonths, frontFileKey, reset } = useScanContext();
  const initialName = scanResult?.product_name || "";
  const initialBrand = scanResult?.brand || "";
  const initialCategory = (scanResult?.category as ProductCategory) || "";
  const initialMethod = scanResult?.name_brand_method;

  const [name, setName] = useState(initialName);
  const [brand, setBrand] = useState(initialBrand);
  const [category, setCategory] = useState<ProductCategory | "">(initialCategory);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Toast.show({
        type: "error",
        text1: "Validation",
        text2: "Product name is required",
        position: "top",
      });
      return;
    }

    setSaving(true);
    try {
      const scanId = scanResult?.scan_id;

      // Check if user edited name/brand
      const nameChanged = name !== initialName || brand !== initialBrand;

      // Update scan result if user edited name/brand
      if (nameChanged && scanId) {
        await updateScanResult(scanId, {
          product_name: name.trim() || undefined,
          brand: brand.trim() || undefined,
          name_brand_method: "manual",
        });
      }

      // Create product
      await createProduct({
        name: name.trim(),
        brand: brand.trim() || undefined,
        category: category || undefined,
        image_s3_key: frontFileKey || undefined,
        scan_id: scanId || null,
      });

      reset();
      Toast.show({
        type: "success",
        text1: "Added",
        text2: `${name.trim()} saved to your shelf`,
        position: "top",
      });
      router.replace("/(main)/products");
    } catch {
      // interceptor shows toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionTitle}>Product Details</Text>

          <TextInput
            style={styles.input}
            placeholder="Product name *"
            placeholderTextColor="#999"
            value={name}
            onChangeText={setName}
            editable={!saving}
          />

          <TextInput
            style={styles.input}
            placeholder="Brand (optional)"
            placeholderTextColor="#999"
            value={brand}
            onChangeText={setBrand}
            editable={!saving}
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
                disabled={saving}
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

          <Text style={styles.sectionTitle}>PAO (Period After Opening)</Text>
          <View style={styles.paoDisplay}>
            <Text style={styles.paoValue}>{formatPao(paoMonths)}</Text>
          </View>

          {initialMethod === "barcode_lookup" && (
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceText}>
                Name & brand from Open Beauty Facts
              </Text>
            </View>
          )}
          {initialMethod === "llm_extraction" && (
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceText}>
                Name & brand extracted from label
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save to My Shelf</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  inner: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
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
  segmentButtonTextActive: { color: "#fff" },
  paoDisplay: {
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  paoValue: { fontSize: 18, fontWeight: "600", color: "#1a1a1a" },
  sourceBadge: {
    backgroundColor: "#f0f4ff",
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    alignItems: "center",
  },
  sourceText: { fontSize: 13, color: "#6c63ff", fontWeight: "500" },
  saveButton: {
    backgroundColor: "#6c63ff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  buttonDisabled: { opacity: 0.7 },
});
