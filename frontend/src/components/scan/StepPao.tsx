import { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import Toast from "react-native-toast-message";
import { getPresignedUrl, uploadToS3 } from "../../api/uploads";
import { processPaoImage } from "../../api/products";
import { useScanContext } from "../../contexts/ScanContext";

export default function StepPao() {
  const { scanResult, setPaoMonths, setStep } = useScanContext();
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const handleSkip = () => {
    setStep("manual-pao");
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

      setIsCapturing(false);
      setIsProcessing(true);

      const fileName = `pao_${Date.now()}.jpg`;
      const { upload_url, file_key } = await getPresignedUrl(fileName, "image/jpeg");
      const response = await fetch(result.uri);
      const blob = await response.blob();
      await uploadToS3(upload_url, blob, "image/jpeg");

      const scanId = scanResult?.scan_id;
      if (scanId) {
        const paoResult = await processPaoImage(file_key, scanId);
        if (paoResult.pao_months !== null) {
          setPaoMonths(paoResult.pao_months);
        }
      }

      setStep("confirm");
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: err?.message || "Failed to process PAO image",
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
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />

      <View style={styles.overlay}>
        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>We couldn't find the PAO symbol</Text>
          <Text style={styles.instructionSubtitle}>Photograph it directly</Text>
        </View>
      </View>

      <View style={styles.skipContainer}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip / Enter manually</Text>
        </TouchableOpacity>
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
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff", padding: 24 },
  text: { fontSize: 16, color: "#333", marginBottom: 16, textAlign: "center" },
  button: { backgroundColor: "#6c63ff", borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  instructions: { backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 16, padding: 24, alignItems: "center", marginHorizontal: 40 },
  instructionTitle: { color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  instructionSubtitle: { color: "#ccc", fontSize: 15, textAlign: "center" },
  skipContainer: { position: "absolute", top: 60, right: 20, zIndex: 10 },
  skipButton: { backgroundColor: "rgba(108,99,255,0.9)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  skipButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  controls: { position: "absolute", bottom: 0, left: 0, right: 0, paddingBottom: 50, alignItems: "center" },
  captureButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", borderWidth: 4, borderColor: "#6c63ff" },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#6c63ff" },
  buttonDisabled: { opacity: 0.7 },
  processing: { alignItems: "center" },
  processingText: { color: "#fff", fontSize: 16, marginTop: 12 },
});
