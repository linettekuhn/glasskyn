import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
} from "react-native";
import { CameraView } from "expo-camera";
import Toast from "react-native-toast-message";
import { getPresignedUrl, uploadToS3 } from "../../api/uploads";
import { processMultiImages } from "../../api/products";
import { useScanContext } from "../../contexts/ScanContext";
import { Colors, getTheme } from "@/constants/theme";
import ScanOverlay from "./scan-overlay";
import { ThemedText } from "../ui/themed-text";
import { GestureDetector, Gesture } from "react-native-gesture-handler";

const btnColor = Colors["light"].primary[400];
const txtColor = Colors["light"].neutral[100];

export default function StepBack({ onClose }: { onClose: () => void }) {
  const {
    frontImageUri,
    barcode,
    setBarcode,
    setBackImageUri,
    setFrontFileKey,
    setBackFileKey,
    setScanResult,
    setPaoMonths,
    setStep,
  } = useScanContext();
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoom, setZoom] = useState(0);
  const zoomAtGestureStart = useRef(0);
  const cameraRef = useRef<CameraView>(null);
  const hasProcessedBarcode = useRef(false);
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

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

  const uploadImage = async (uri: string, prefix: string): Promise<string> => {
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

      const [frontFileKey, backFileKey] = await Promise.all([
        uploadImage(frontImageUri, "front"),
        uploadImage(result.uri, "back"),
      ]);

      setFrontFileKey(frontFileKey);
      setBackFileKey(backFileKey);

      const resultData = await processMultiImages(
        frontFileKey,
        backFileKey,
        barcode,
      );

      setScanResult(resultData);

      if (resultData.pao_months !== null) {
        setPaoMonths(resultData.pao_months);
        setStep("confirm");
      } else {
        setStep("pao");
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

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      zoomAtGestureStart.current = zoom;
    })
    .onUpdate((e) => {
      const newZoom = zoomAtGestureStart.current + (e.scale - 1) * 0.1;
      setZoom(Math.min(Math.max(newZoom, 0), 1));
    })
    .runOnJS(true);

  return (
    <GestureDetector gesture={pinchGesture}>
      <View style={styles.container}>
        <CameraView
          zoom={zoom}
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "upc_a", "code128", "code39"],
          }}
        />

      <ScanOverlay scanArea={{ width: 300, height: 450, top: 120 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>✕</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.iconButton} onPress={() => {}}>
            <Text style={styles.iconButtonText}>⚡</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSection}>
          <View style={{ alignItems: "center", gap: 8 }}>
            <ThemedText style={{ color: txtColor }} type="bodyLarge">
              Point and capture the{" "}
              <ThemedText
                style={{ color: txtColor }}
                type="bodyLarge"
                weight="bold"
              >
                back
              </ThemedText>{" "}
              of your product
            </ThemedText>
            <View style={styles.link}>
              <ThemedText style={{ color: txtColor }}>
                No back label?
              </ThemedText>
              <ThemedText
                link
                style={{ color: Colors["light"].secondary[400] }}
                onPressWhenLink={() => setStep("pao")}
              >
                Skip this step
              </ThemedText>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.captureButton,
              (isCapturing || isProcessing) && styles.buttonDisabled,
            ]}
            onPress={handleCapture}
            disabled={isCapturing || isProcessing}
          >
            {isCapturing || isProcessing ? (
              <ActivityIndicator size="large" color={btnColor} />
            ) : (
              <View style={styles.captureInner} />
            )}
          </TouchableOpacity>
        </View>
      </ScanOverlay>
    </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "center",
  },
  topBar: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconButtonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  bottomSection: {
    position: "absolute",
    bottom: 70,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 24,
  },
  captureButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(0, 0, 0, 0)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: btnColor,
  },
  captureInner: {
    width: 85,
    height: 85,
    borderRadius: 50,
    backgroundColor: btnColor,
  },
  buttonDisabled: { opacity: 0.7 },
});
