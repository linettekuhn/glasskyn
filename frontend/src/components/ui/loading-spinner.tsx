import { Colors, getTheme } from "@/constants/theme";
import {
  View,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
} from "react-native";

export default function LoadingSpinner() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.neutral[700]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
