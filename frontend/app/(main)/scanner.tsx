import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { CameraView, useCameraPermissions, CameraType } from "expo-camera";
import Toast from "react-native-toast-message";
import { getPresignedUrl, uploadToS3 } from "../../src/api/uploads";
import { processImage } from "../../src/api/products";

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const lastScanned = useRef<string | null>(null);

  useFocusEffect(() => {
    lastScanned.current = null;
  });

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing || isProcessing) return;
    setIsCapturing(true);
    console.log("[DEBUG] Starting capture...");

    try {
      // Take a picture using camera ref
      console.log("[DEBUG] Taking picture...");
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      console.log("[DEBUG] Picture taken, uri:", result?.uri);

      if (!result?.uri) {
        console.log("[DEBUG] No picture uri, stopping");
        setIsCapturing(false);
        return;
      }

      setIsCapturing(false);
      setIsProcessing(true);
      console.log("[DEBUG] Getting pre-signed URL...");

      // Step 1: Get pre-signed URL
      const fileName = `scan_${Date.now()}.jpg`;
      const { upload_url, file_key, public_url } = await getPresignedUrl(
        fileName,
        "image/jpeg"
      );
      console.log("[DEBUG] Got presigned URL, file_key:", file_key);

      // Step 2: Upload to S3
      console.log("[DEBUG] Fetching image blob...");
      const response = await fetch(result.uri);
      console.log("[DEBUG] Fetch response status:", response.status);
      const blob = await response.blob();
      console.log("[DEBUG] Blob size:", blob.size);

      console.log("[DEBUG] Uploading to S3...");
      await uploadToS3(upload_url, blob, "image/jpeg");
      console.log("[DEBUG] S3 upload complete");

      // Step 3: Process image (barcode lookup + TODO: OCR, classifier)
      console.log("[DEBUG] Calling process endpoint, barcode:", lastScanned.current);
      const productData = await processImage(file_key, lastScanned.current);
      console.log("[DEBUG] Process result:", productData);

      // Step 4: Navigate to add product with pre-filled data
      console.log("[DEBUG] Navigating to add-product...");
      router.push({
        pathname: "/(modals)/add-product",
        params: {
          name: productData.name || "",
          brand: productData.brand || "",
          category: productData.category || "",
          barcode: productData.barcode || "",
          imageUrl: public_url,
          imageS3Key: file_key,
        },
      });
    } catch (err: any) {
      console.error("[DEBUG] Capture error:", err);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: err?.message || "Failed to process image",
      });
    } finally {
      setIsCapturing(false);
      setIsProcessing(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6c63ff" />
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
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "code128", "code39"],
        }}
        onBarcodeScanned={(result) => {
          if (lastScanned.current !== result.data) {
            lastScanned.current = result.data;
          }
        }}
      />

      <View style={styles.overlay}>
        <View style={styles.scanArea}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        <Text style={styles.hint}>
          Position product barcode or photo within frame
        </Text>
      </View>

      <View style={styles.controls}>
        {isProcessing ? (
          <View style={styles.processing}>
            <ActivityIndicator size="large" color="#6c63ff" />
            <Text style={styles.processingText}>Processing...</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.captureButton, (isCapturing || isProcessing) && styles.buttonDisabled]}
            onPress={handleCapture}
            disabled={isCapturing || isProcessing}
          >
            {isCapturing ? (
              <ActivityIndicator size="small" color="#6c63ff" />
            ) : (
              <View style={styles.captureInner} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 24,
  },
  text: {
    fontSize: 16,
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#6c63ff",
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  scanArea: {
    width: 280,
    height: 180,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#6c63ff",
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  hint: {
    color: "#fff",
    fontSize: 14,
    marginTop: 20,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  controls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 50,
    alignItems: "center",
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#6c63ff",
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#6c63ff",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  processing: {
    alignItems: "center",
  },
  processingText: {
    color: "#fff",
    fontSize: 16,
    marginTop: 12,
  },
});