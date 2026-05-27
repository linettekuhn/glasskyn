import { useState, useRef } from "react";
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
import { processPaoImage } from "../../api/products";
import { useScanContext } from "../../contexts/ScanContext";
import { Colors, getTheme } from "@/constants/theme";
import ScanOverlay from "./scan-overlay";
import { ThemedText } from "../ui/themed-text";
import { MaterialIcons } from "@expo/vector-icons";
import { GestureDetector, Gesture } from "react-native-gesture-handler";

const btnColor = Colors["light"].primary[400];
const txtColor = Colors["light"].neutral[100];

export default function StepPao({ onClose }: { onClose: () => void }) {
  const { scanResult, setPaoMonths, setStep } = useScanContext();
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [torch, setTorch] = useState(false);
  const zoomAtGestureStart = useRef(0);
  const cameraRef = useRef<CameraView>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

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
      const { upload_url, file_key } = await getPresignedUrl(
        fileName,
        "image/jpeg",
      );
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
          enableTorch={torch}
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
        />
        <ScanOverlay scanArea={{ width: 300, height: 250, top: 120 }}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onClose} style={styles.iconButton}>
              <Text style={styles.iconButtonText}>✕</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={[styles.iconButton, torch && { backgroundColor: "rgba(255, 200, 0, 0.6)" }]}
              onPress={() => setTorch(prev => !prev)}
            >
              <Text style={styles.iconButtonText}>⚡</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.bottomSection}>
            <View style={{ alignItems: "center", gap: 8 }}>
              <ThemedText
                type="bodyLarge"
                style={{
                  textAlign: "center",
                  color: txtColor,
                }}
              >
                We couldn&apos;t find the {"\n"} Period After Opening (PAO)
                symbol
              </ThemedText>
              <View
                style={[styles.hint, { backgroundColor: colors.neutral[100] }]}
              >
                <View
                  style={[
                    styles.hintIcon,
                    { backgroundColor: colors.primary[400] },
                  ]}
                >
                  <MaterialIcons
                    name="lightbulb-outline"
                    size={32}
                    color={colors.primary[700]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText
                    type="captionLarge"
                    style={{ color: colors.primary[900] }}
                    weight="medium"
                  >
                    Can&apos;t find the PAO?
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: colors.primary[700] }}
                  >
                    Check the bottle for a small open jar icon with a number
                    capture it directly.
                  </ThemedText>
                </View>
              </View>
              <View style={styles.link}>
                <ThemedText style={{ color: txtColor }}>
                  No PAO symbol?
                </ThemedText>
                <ThemedText
                  link
                  style={{ color: Colors["light"].secondary[400] }}
                  onPressWhenLink={() => setStep("confirm")}
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
    paddingHorizontal: 12,
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
  hint: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  hintIcon: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    borderRadius: 8,
  },
});
