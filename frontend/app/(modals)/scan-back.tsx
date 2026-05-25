import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import Toast from "react-native-toast-message";
import { getPresignedUrl, uploadToS3 } from "../../src/api/uploads";
import { processMultiImages } from "../../src/api/products";
import { useScanContext } from "../../src/contexts/ScanContext";

export default function ScanBackScreen() {
  const {
    frontImageUri,
    barcode,
    setBarcode,
    setBackImageUri,
    setFrontFileKey,
    setBackFileKey,
    setScanResult,
    setPaoMonths,
  } = useScanContext();
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const hasProcessedBarcode = useRef(false);

  useEffect(() => {
    hasProcessedBarcode.current = false;
  }, []);

  const handleBarcodeScanned = useCallback(
    (result: { data: string }) => {
      if (hasProcessedBarcode.current || barcode) return;
      hasProcessedBarcode.current = true;
      setBarcode(result.data);
      Toast.show({
        type: "success",
        text1: "Barcode found",
        text2: result.data,
        position: "top",
        visibilityTime: 2000,
      });
    },
    [barcode, setBarcode],
  );

  const uploadImage = async (
    uri: string,
    prefix: string,
  ): Promise<string> => {
    const fileName = `${prefix}_${Date.now()}.jpg`;
    const { upload_url, file_key } = await getPresignedUrl(
      fileName,
      "image/jpeg",
    );
    const response = await fetch(uri);
    const blob = await response.blob();
    await uploadToS3(upload_url, blob, "image/jpeg");
    return file_key;
  };

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing || isProcessing) return;
    setIsCapturing(true);

    try {
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (!result?.uri) {
        setIsCapturing(false);
        return;
      }

      setBackImageUri(result.uri);
      setIsCapturing(false);
      setIsProcessing(true);

      if (!frontImageUri) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Front image missing — please restart",
        });
        setIsProcessing(false);
        return;
      }

      // Upload both images to S3 in parallel
      const [frontFileKey, backFileKey] = await Promise.all([
        uploadImage(frontImageUri, "front"),
        uploadImage(result.uri, "back"),
      ]);

      setFrontFileKey(frontFileKey);
      setBackFileKey(backFileKey);

      // Call process-multi with both keys + barcode
      const resultData = await processMultiImages(
        frontFileKey,
        backFileKey,
        barcode,
      );

      setScanResult(resultData);

      if (resultData.pao_months !== null) {
        setPaoMonths(resultData.pao_months);
        router.replace("/(modals)/scan-confirm");
      } else {
        router.replace("/(modals)/scan-pao");
      }
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: err?.message || "Failed to process",
      });
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
        onBarcodeScanned={handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "code128", "code39"],
        }}
      />

      <View style={styles.overlay}>
        <View style={styles.scanArea}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        <Text style={styles.hint}>Point at the back label</Text>
        {barcode && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Barcode: {barcode}</Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        {isProcessing ? (
          <View style={styles.processing}>
            <ActivityIndicator size="large" color="#6c63ff" />
            <Text style={styles.processingText}>Processing...</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.captureButton, isCapturing && styles.buttonDisabled]}
            onPress={handleCapture}
            disabled={isCapturing}
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
  container: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 24,
  },
  text: { fontSize: 16, color: "#333", marginBottom: 16, textAlign: "center" },
  button: {
    backgroundColor: "#6c63ff",
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  scanArea: { width: 280, height: 180, position: "relative" },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#6c63ff",
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  hint: {
    color: "#fff",
    fontSize: 16,
    marginTop: 20,
    textAlign: "center",
    paddingHorizontal: 40,
    fontWeight: "600",
  },
  badge: {
    backgroundColor: "#6c63ff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },
  badgeText: { color: "#fff", fontSize: 14, fontWeight: "600" },
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
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#6c63ff" },
  buttonDisabled: { opacity: 0.7 },
  processing: { alignItems: "center" },
  processingText: { color: "#fff", fontSize: 16, marginTop: 12 },
});
