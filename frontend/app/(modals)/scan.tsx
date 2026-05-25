import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useScanContext } from "../../src/contexts/ScanContext";
import StepFront from "../../src/components/scan/StepFront";
import StepBack from "../../src/components/scan/StepBack";
import StepPao from "../../src/components/scan/StepPao";
import StepManualPao from "../../src/components/scan/StepManualPao";
import StepConfirm from "../../src/components/scan/StepConfirm";

export default function ScanScreen() {
  const { step, reset } = useScanContext();
  const isCameraStep = step === "front" || step === "back" || step === "pao";

  const handleClose = () => {
    reset();
    router.back();
  };

  if (isCameraStep) {
    return (
      <View style={styles.cameraContainer}>
        {step === "front" && <StepFront />}
        {step === "back" && <StepBack />}
        {step === "pao" && <StepPao />}

        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.nonCameraContainer} edges={["bottom"]}>
      {step === "manual-pao" && <StepManualPao />}
      {step === "confirm" && <StepConfirm />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cameraContainer: { flex: 1, backgroundColor: "#000" },
  nonCameraContainer: { flex: 1, backgroundColor: "#fff" },
  closeButton: {
    position: "absolute",
    top: 60,
    left: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
