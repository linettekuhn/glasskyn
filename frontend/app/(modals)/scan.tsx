import { View, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useScanContext } from "../../src/contexts/ScanContext";
import StepFront from "../../src/components/scan/step-front";
import StepBack from "../../src/components/scan/step-back";
import StepPao from "../../src/components/scan/step-pao";
import StepConfirm from "../../src/components/scan/step-confirm";

export default function ScanScreen() {
  const { step, reset } = useScanContext();
  const { returnTo, routineId, stepId, stepType } = useLocalSearchParams<{
    returnTo?: string;
    routineId?: string;
    stepId?: string;
    stepType?: string;
  }>();
  const isCameraStep = step === "front" || step === "back" || step === "pao";

  const handleClose = () => {
    reset();
    router.back();
  };

  if (isCameraStep) {
    return (
      <View style={styles.cameraContainer}>
        {step === "front" && <StepFront onClose={handleClose} />}
        {step === "back" && <StepBack onClose={handleClose} />}
        {step === "pao" && <StepPao onClose={handleClose} />}
      </View>
    );
  }

  return (
    <View style={styles.nonCameraContainer}>
      {step === "confirm" && (
        <StepConfirm
          returnTo={returnTo}
          returnParams={
            routineId && stepId && stepType
              ? { routineId, stepId, stepType }
              : undefined
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cameraContainer: { flex: 1, backgroundColor: "#000" },
  nonCameraContainer: { flex: 1, backgroundColor: "#fff" },
});
