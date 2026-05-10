import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import Toast from "react-native-toast-message";
import { lookupProduct, createProduct } from "../../src/api/products";

export default function ScanBarcodeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<
    "camera" | "manual" | "scanning" | "result" | "not_found"
  >("camera");
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<{
    name: string;
    brand: string;
    category: string;
  } | null>(null);
  const [manualInput, setManualInput] = useState("");
  const lastScanned = useRef<string | null>(null);

  const handleBarcode = async (code: string) => {
    if (lastScanned.current === code) return;
    lastScanned.current = code;
    setBarcode(code);
    setState("scanning");

    try {
      const result = await lookupProduct(code);
      setProduct({
        name: result.product_name || code,
        brand: result.brands || "",
        category: result.categories || "",
      });
      setState("result");
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setState("not_found");
      } else {
        setState("camera");
      }
    }
  };

  const handleManualLookup = () => {
    if (!manualInput.trim()) return;
    handleBarcode(manualInput.trim());
  };

  const handleAdd = async () => {
    if (!product) return;
    try {
      await createProduct({
        name: product.name,
        brand: product.brand || undefined,
        category: product.category || undefined,
      });
      Toast.show({
        type: "success",
        text1: "Added",
        text2: product.name,
      });
      router.back();
    } catch {
      // toast already shown by interceptor
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Camera access required</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.secondary]}
          onPress={() => setState("manual")}
        >
          <Text style={styles.buttonText}>Enter Barcode Manually</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {state === "camera" && (
        <CameraView
          style={StyleSheet.absoluteFill}
          onBarcodeScanned={(result) => handleBarcode(result.data)}
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "upc_a", "code128", "code39"],
          }}
        />
      )}

      {state === "manual" && (
        <View style={styles.center}>
          <Text style={styles.text}>Enter barcode</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 3560070791460"
            placeholderTextColor="#999"
            value={manualInput}
            onChangeText={setManualInput}
            keyboardType="number-pad"
            autoFocus
          />
          <TouchableOpacity style={styles.button} onPress={handleManualLookup}>
            <Text style={styles.buttonText}>Lookup</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.secondary]}
            onPress={() => setState("camera")}
          >
            <Text style={styles.buttonText}>Use Camera</Text>
          </TouchableOpacity>
        </View>
      )}

      {state === "scanning" && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6c63ff" />
          <Text style={styles.text}>Looking up product...</Text>
        </View>
      )}

      {state === "not_found" && (
        <View style={styles.center}>
          <Text style={styles.text}>Product not found</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              lastScanned.current = null;
              setState("camera");
            }}
          >
            <Text style={styles.buttonText}>Scan Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {state === "result" && product && (
        <View style={styles.center}>
          <Text style={styles.title}>{product.name}</Text>
          {product.brand ? (
            <Text style={styles.text}>Brand: {product.brand}</Text>
          ) : null}
          {product.category ? (
            <Text style={styles.text}>Category: {product.category}</Text>
          ) : null}
          <Text style={styles.barcode}>Barcode: {barcode}</Text>

          <TouchableOpacity style={styles.button} onPress={handleAdd}>
            <Text style={styles.buttonText}>Add to My Products</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.secondary]}
            onPress={() => {
              lastScanned.current = null;
              setState("camera");
            }}
          >
            <Text style={styles.buttonText}>Scan Another</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  text: {
    fontSize: 16,
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
    textAlign: "center",
  },
  barcode: {
    fontSize: 13,
    color: "#999",
    marginBottom: 24,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    width: "100%",
    marginBottom: 16,
    backgroundColor: "#fafafa",
    color: "#1a1a1a",
  },
  button: {
    backgroundColor: "#6c63ff",
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginBottom: 12,
    minWidth: 200,
    alignItems: "center",
  },
  secondary: {
    backgroundColor: "#eee",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
