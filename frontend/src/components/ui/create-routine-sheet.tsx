import {
  Modal,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from "react-native";
import { router } from "expo-router";
import { Colors, getTheme } from "@/constants/theme";
import { CREATE_ROUTINE_OPTIONS } from "@/constants/routine";
import { ThemedText } from "./themed-text";
import CreateRoutineOptionRow from "./create-routine-option";

interface CreateRoutineSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function CreateRoutineSheet({
  visible,
  onClose,
}: CreateRoutineSheetProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const handleOption = (route?: string) => {
    onClose();
    if (route) router.push(route as any);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.sheet, { backgroundColor: colors.background }]}
        >
          <ThemedText type="h3" weight="bold">
            New Routine
          </ThemedText>
          <ThemedText
            type="bodySmall"
            style={{ color: colors.neutral[600], marginBottom: 8 }}
          >
            Choose how you&apos;d like to start
          </ThemedText>

          {CREATE_ROUTINE_OPTIONS.map((option) => (
            <CreateRoutineOptionRow
              key={option.title}
              option={option}
              onPress={() => handleOption(option.route)}
            />
          ))}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  sheet: {
    width: "100%",
    borderRadius: 16,
    padding: 24,
    gap: 8,
  },
});
