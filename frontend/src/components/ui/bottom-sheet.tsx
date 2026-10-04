import { useEffect, ReactNode } from "react";
import {
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Colors, getTheme } from "@/constants/theme";

export type BottomSheetSnap = "peek" | "expanded";

const SPRING_CONFIG = { damping: 22, stiffness: 200, mass: 0.7 };

type BottomSheetProps = {
  snap: BottomSheetSnap;
  onSnapChange: (snap: BottomSheetSnap) => void;
  collapsedContent: ReactNode;
  expandedContent: ReactNode;
  peekHeight?: number;
  expandedVisibleRatio?: number;
  /** When true the sheet is pinned to peek: gestures can't pull it up. */
  locked?: boolean;
};

export default function BottomSheet({
  snap,
  onSnapChange,
  collapsedContent,
  expandedContent,
  peekHeight = 154,
  expandedVisibleRatio = 0.82,
  locked = false,
}: BottomSheetProps) {
  const { height } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const expandedOffset = height - Math.round(height * expandedVisibleRatio);
  const peekOffset = height - peekHeight;
  const effectiveSnap = locked ? "peek" : snap;

  const translateY = useSharedValue(
    effectiveSnap === "peek" ? peekOffset : expandedOffset,
  );
  const targetShared = useSharedValue(
    effectiveSnap === "peek" ? peekOffset : expandedOffset,
  );

  useEffect(() => {
    const target = effectiveSnap === "peek" ? peekOffset : expandedOffset;
    if (targetShared.value === target) return;
    targetShared.value = target;
    translateY.value = withSpring(target, SPRING_CONFIG);
  }, [effectiveSnap, peekOffset, expandedOffset, targetShared, translateY]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.min(
        peekOffset,
        Math.max(
          locked ? peekOffset : expandedOffset,
          targetShared.value + e.translationY,
        ),
      );
    })
    .onEnd((e) => {
      const projected = targetShared.value + e.translationY + e.velocityY * 0.25;
      const mid = (peekOffset + expandedOffset) / 2;
      const nearest =
        locked || projected >= mid ? peekOffset : expandedOffset;
      translateY.value = withSpring(nearest, SPRING_CONFIG);
      if (nearest !== targetShared.value) {
        targetShared.value = nearest;
        runOnJS(onSnapChange)(nearest === expandedOffset ? "expanded" : "peek");
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.sheet,
        { backgroundColor: colors.background, height },
        animatedStyle,
      ]}
    >
      <GestureDetector gesture={pan}>
        <View style={styles.handleRow} collapsable={false}>
          <View style={[styles.handleBar, { backgroundColor: colors.neutral[300] }]} />
        </View>
      </GestureDetector>
      {effectiveSnap === "peek" ? (
        <View style={styles.collapsedContent}>{collapsedContent}</View>
      ) : (
        <View style={styles.expandedContent}>{expandedContent}</View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  handleRow: {
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  handleBar: {
    width: 48,
    height: 5,
    borderRadius: 3,
  },
  collapsedContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  expandedContent: {
    flex: 1,
  },
});