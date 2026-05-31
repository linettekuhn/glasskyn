import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from "react-native";
import { CameraView } from "expo-camera";
import Toast from "react-native-toast-message";
import { getPresignedUrl, uploadToS3 } from "../../api/uploads";
import { processMultiImages } from "../../api/products";
import { useScanContext } from "../../contexts/ScanContext";
import { Colors } from "@/constants/theme";
import ScanOverlay from "./scan-overlay";
import { ThemedText } from "../ui/themed-text";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { useBlurCheck } from "../../hooks/use-blur-check";
import ThemedButton from "../ui/themed-button";
import IconButton from "../ui/icon-button";
import ScanBadge from "./scan-badge";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const btnColor = Colors["light"].primary[400];
const txtColor = Colors["light"].neutral[100];
const scanArea = { width: 300, height: 450, top: 120 };

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
  const [torch, setTorch] = useState(false);
  const [phase, setPhase] = useState<"camera" | "preview">("camera");
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const zoomAtGestureStart = useRef(0);
  const cameraRef = useRef<CameraView>(null);
  const hasProcessedBarcode = useRef(false);
  const { blurStatus, variance } = useBlurCheck(
    phase === "preview" ? capturedUri : null,
  );

  useEffect(() => {
    hasProcessedBarcode.current = false;
  }, []);

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (hasProcessedBarcode.current || barcode) return;
      hasProcessedBarcode.current = true;
      setBarcode(data);
      Toast.show({
        type: "success",
        text1: "Barcode found",
        text2: data,
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
      if (!result?.uri) return;
      setCapturedUri(result.uri);
      setPhase("preview");
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: err?.message || "Failed to capture image",
      });
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    setCapturedUri(null);
    setPhase("camera");
  };

  const handleConfirm = async () => {
    if (!capturedUri || isProcessing) return;
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

    try {
      setBackImageUri(capturedUri);
      const [frontFileKey, backFileKey] = await Promise.all([
        uploadImage(frontImageUri, "front"),
        uploadImage(capturedUri, "back"),
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
      setZoom(
        Math.min(
          Math.max(zoomAtGestureStart.current + (e.scale - 1) * 0.1, 0),
          1,
        ),
      );
    })
    .runOnJS(true);

  const isPreview = phase === "preview" && !!capturedUri;

  return (
    <GestureDetector gesture={pinchGesture}>
      <View style={styles.container}>
        {isPreview ? (
          <Image
            source={{ uri: capturedUri! }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <CameraView
            zoom={zoom}
            enableTorch={torch}
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "ean8", "upc_a", "code128", "code39"],
            }}
          />
        )}

        <ScanOverlay scanArea={scanArea}>
          <View style={styles.topBar}>
            <IconButton
              onPress={isPreview ? handleRetake : onClose}
              IconComponent={MaterialCommunityIcons}
              iconName="close"
              iconColor={txtColor}
            />
            {!isPreview && (
              <>
                <View style={{ flex: 1 }} />
                <IconButton
                  onPress={() => setTorch((p) => !p)}
                  IconComponent={MaterialCommunityIcons}
                  iconName="flashlight"
                  iconColor={txtColor}
                  active={torch}
                  activeColor={btnColor}
                />
              </>
            )}
          </View>

          <View style={styles.bottomSection}>
            {isPreview ? (
              <>
                <ScanBadge status={blurStatus} />
                <View style={{ alignItems: "center", gap: 4 }}>
                  <ThemedText
                    style={{ color: txtColor }}
                    type="bodyLarge"
                    weight="bold"
                  >
                    Back label captured
                  </ThemedText>
                  <ThemedText
                    style={{ color: txtColor, opacity: 0.7 }}
                    type="caption"
                  >
                    Score: {variance.toFixed(1)}
                  </ThemedText>
                </View>
                <View style={styles.buttonRow}>
                  <ThemedButton
                    text="Retake"
                    color={btnColor}
                    outlined
                    onPress={handleRetake}
                    alignment="stretch"
                    leftIconName="reload"
                    LeftIconComponent={MaterialCommunityIcons}
                  />
                  <ThemedButton
                    text="Use Photo"
                    color={btnColor}
                    onPress={handleConfirm}
                    alignment="stretch"
                    loading={isProcessing}
                    leftIconName="check"
                    LeftIconComponent={MaterialCommunityIcons}
                  />
                </View>
              </>
            ) : (
              <>
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
              </>
            )}
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
  bottomSection: {
    position: "absolute",
    bottom: 70,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 20,
    paddingHorizontal: 20,
  },
  captureButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    width: "100%",
    paddingHorizontal: 20,
  },
});
