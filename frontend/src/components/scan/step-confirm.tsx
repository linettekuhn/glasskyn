import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import { createProduct, updateScanResult } from "../../api/products";
import type { ProductCategory } from "../../types";
import { useScanContext } from "../../contexts/ScanContext";

const CATEGORIES: ProductCategory[] = ["skincare", "makeup", "haircare"];

export default function StepConfirm() {
  const { scanResult, paoMonths, setPaoMonths, frontFileKey, reset } = useScanContext();
  const initialName = scanResult?.product_name || "";
  const initialBrand = scanResult?.brand || "";
  const initialCategory = (scanResult?.category as ProductCategory) || "";
  const initialMethod = scanResult?.name_brand_method;

  const [name, setName] = useState(initialName);
  const [brand, setBrand] = useState(initialBrand);
  const [category, setCategory] = useState<ProductCategory | "">(initialCategory);
  const [paoInput, setPaoInput] = useState(paoMonths !== null ? `${paoMonths}` : "");
  const [saving, setSaving] = useState(false);

  const normalizePao = (input: string): number | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/(\d+)/);
    if (!match) return null;
    const months = parseInt(match[1], 10);
    if (months < 1 || months > 120) return null;
    return months;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Toast.show({ type: "error", text1: "Validation", text2: "Product name is required", position: "top" });
      return;
    }

    setSaving(true);
    try {
      const scanId = scanResult?.scan_id;
      const paoValue = paoInput ? normalizePao(paoInput) : null;

      const nameChanged = name !== initialName || brand !== initialBrand;
      const paoChanged = paoValue !== null && paoValue !== paoMonths;

      if ((nameChanged || paoChanged) && scanId) {
        await updateScanResult(scanId, {
          product_name: name.trim() || undefined,
          brand: brand.trim() || undefined,
          name_brand_method: nameChanged ? "manual" : undefined,
          pao_months: paoChanged ? paoValue : undefined,
        });
      }

      if (paoValue !== null) {
        setPaoMonths(paoValue);
      }

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

  const handleCancel = () => {
    reset();
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView style={styles.inner} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
                style={[styles.segmentButton, category === cat && styles.segmentButtonActive]}
                onPress={() => setCategory(category === cat ? "" : cat)}
                disabled={saving}
              >
                <Text style={[styles.segmentButtonText, category === cat && styles.segmentButtonTextActive]}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>PAO (Period After Opening)</Text>
          <View>
            <TextInput
              style={styles.input}
              placeholder="PAO in months (e.g. 12M, 6, 24)"
              placeholderTextColor="#999"
              value={paoInput}
              onChangeText={setPaoInput}
              editable={!saving}
            />
            <Text style={styles.paoHint}>
              {paoMonths !== null
                ? `Currently set to ${paoMonths} months — edit if incorrect`
                : "PAO was not detected — enter it manually"}
            </Text>
          </View>

          {initialMethod === "barcode_lookup" && (
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceText}>Name & brand from Open Beauty Facts</Text>
            </View>
          )}
          {initialMethod === "llm_extraction" && (
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceText}>Name & brand extracted from label</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save to My Shelf</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={saving}>
            <Text style={styles.cancelButtonText}>Cancel Scan</Text>
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
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 12, backgroundColor: "#fafafa", color: "#1a1a1a" },
  segmentedControl: { flexDirection: "row", gap: 8, marginBottom: 16 },
  segmentButton: { flex: 1, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: "#ddd", backgroundColor: "#fafafa", alignItems: "center" },
  segmentButtonActive: { backgroundColor: "#6c63ff", borderColor: "#6c63ff" },
  segmentButtonText: { fontSize: 14, fontWeight: "600", color: "#666", textTransform: "capitalize" },
  segmentButtonTextActive: { color: "#fff" },
  paoHint: { fontSize: 13, color: "#999", textAlign: "center", marginTop: -8, marginBottom: 16 },
  sourceBadge: { backgroundColor: "#f0f4ff", borderRadius: 8, padding: 10, marginBottom: 16, alignItems: "center" },
  sourceText: { fontSize: 13, color: "#6c63ff", fontWeight: "500" },
  saveButton: { backgroundColor: "#6c63ff", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  buttonDisabled: { opacity: 0.7 },
  cancelButton: { padding: 16, alignItems: "center", marginTop: 4, marginBottom: 24 },
  cancelButtonText: { color: "#999", fontSize: 15, fontWeight: "500" },
});
