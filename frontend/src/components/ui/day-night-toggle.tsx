import { useEffect } from "react";
import { Colors, getTheme } from "@/constants/theme";
import {
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { ThemedText } from "./themed-text";
import { AntDesign, Ionicons } from "@expo/vector-icons";

type Props = {
  value: boolean;
  onValueChange: (v: boolean) => void;
};

const TOGGLE_HEIGHT = 40;
const PADDING = 4;
const BORDER_WIDTH = 1;
const KNOB_SIZE = TOGGLE_HEIGHT - PADDING * 2 - BORDER_WIDTH * 2;

export default function DayNightToggle({ value, onValueChange }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const trackWidth = TOGGLE_HEIGHT * 2;
  const contentWidth = trackWidth - BORDER_WIDTH * 2;
  const knobOffset = contentWidth - KNOB_SIZE - PADDING * 2;

  const knobPosition = useSharedValue(value ? 0 : knobOffset);

  useEffect(() => {
    knobPosition.value = withTiming(value ? 0 : knobOffset);
  }, [value, knobOffset]);

  const animatedKnobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knobPosition.value }],
  }));

  return (
    <TouchableOpacity
      style={[
        styles.track,
        {
          backgroundColor: value ? colors.secondary[500] : colors.primary[500],
          borderColor: value ? colors.secondary[500] : colors.primary[500],
          width: trackWidth,
          height: TOGGLE_HEIGHT,
        },
      ]}
      onPress={() => onValueChange(!value)}
      activeOpacity={0.8}
    >
      <View style={styles.half}>
        <ThemedText
          type="caption"
          weight="bold"
          style={{ color: !value ? colors.background : "transparent" }}
        >
          PM
        </ThemedText>
      </View>

      <View style={styles.half}>
        <ThemedText
          type="caption"
          weight="bold"
          style={{ color: value ? colors.background : "transparent" }}
        >
          AM
        </ThemedText>
      </View>

      <Animated.View
        style={[
          styles.knob,
          {
            width: KNOB_SIZE,
            height: KNOB_SIZE,
            borderRadius: KNOB_SIZE / 2,
            backgroundColor: colors.background,
          },
          animatedKnobStyle,
        ]}
      >
        {value ? (
          <Ionicons name="sunny" size={16} color={colors.secondary[700]} />
        ) : (
          <AntDesign name="moon" size={14} color={colors.primary[700]} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    borderRadius: TOGGLE_HEIGHT / 2,
    borderWidth: BORDER_WIDTH,
    position: "relative",
    alignItems: "center",
  },
  half: {
    flex: 1,
    height: "100%",
    gap: 2,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  knob: {
    position: "absolute",
    top: PADDING,
    left: PADDING,
    zIndex: 0,
    justifyContent: "center",
    alignItems: "center",
  },
});
