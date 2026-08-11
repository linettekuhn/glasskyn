import { useState, useRef } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  useColorScheme,
} from "react-native";
import { CameraView } from "expo-camera";
import Toast from "react-native-toast-message";
import { getPresignedUrl, uploadToS3 } from "../../api/uploads";
import { processPaoImage } from "../../api/products";
import { useScanContext } from "../../contexts/ScanContext";
import { Colors, getTheme } from "@/constants/theme";
import { withAlpha } from "../ui/glass-surface";
import ScanOverlay from "./scan-overlay";
import { ThemedText } from "../ui/themed-text";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Pao12 from "../../../assets/icons/pao12.svg";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { useBlurCheck } from "../../hooks/use-blur-check";
import ThemedButton from "../ui/themed-button";
import IconButton from "../ui/icon-button";
import ScanBadge from "./scan-badge";

const btnColor = Colors["light"].primary[400];
const txtColor = Colors["light"].neutral[100];
const scanArea = { width: 300, height: 250, top: 120 };

export default function StepPao({ onClose }: { onClose: () => void }) {
  const { scanResult, setPaoMonths, setStep } = useScanContext();
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [torch, setTorch] = useState(false);
  const [phase, setPhase] = useState<"camera" | "preview">("camera");
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const zoomAtGestureStart = useRef(0);
  const cameraRef = useRef<CameraView>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const { blurStatus, variance } = useBlurCheck(
    phase === "preview" ? capturedUri : null,
  );

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
    try {
      const fileName = `pao_${Date.now()}.jpg`;
      const { upload_url, file_key } = await getPresignedUrl(
        fileName,
        "image/jpeg",
      );
      const response = await fetch(capturedUri);
      const blob = await response.blob();
      await uploadToS3(upload_url, blob, "image/jpeg");
      const scanId = scanResult?.scan_id;
      if (scanId) {
        const paoResult = await processPaoImage(file_key, scanId);
        if (paoResult.pao_months !== null) setPaoMonths(paoResult.pao_months);
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
                    PAO symbol captured
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
                  <ThemedText
                    type="bodyLarge"
                    style={{ textAlign: "center", color: txtColor }}
                  >
                    We couldn&apos;t find the {"\n"} Period After Opening (PAO)
                    symbol
                  </ThemedText>
                  <View
                    style={[
                      styles.hint,
                      { backgroundColor: withAlpha(colors.neutral[100], 0.5) },
                    ]}
                  >
                    <View
                      style={[
                        styles.hintIcon,
                        { backgroundColor: colors.primary[400] },
                      ]}
                    >
                      <Pao12
                        width={48}
                        height={48}
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
                        and capture it directly.
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.link}>
                    <ThemedText style={{ color: txtColor }}>
                      No PAO symbol?
                    </ThemedText>
                    <ThemedButton
                      link
                      onPress={() => setStep("confirm")}
                      color={Colors["light"].secondary[400]}
                      text="Skip this step"
                    />
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
