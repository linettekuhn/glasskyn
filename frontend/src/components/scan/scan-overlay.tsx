import { Colors } from "@/constants/theme";
import type { PropsWithChildren } from "react";
import { useWindowDimensions, View, StyleSheet } from "react-native";

type ScanArea = {
  width: number;
  height: number;
  top?: number;
  left?: number;
};

export default function ScanOverlay({
  scanArea,
  children,
}: PropsWithChildren<{ scanArea: ScanArea }>) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const overlayLeft = scanArea.left ?? (screenWidth - scanArea.width) / 2;
  const overlayTop = scanArea.top ?? (screenHeight - scanArea.height) / 2;
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View
          style={[
            styles.overlayStrip,
            { top: 0, left: 0, right: 0, height: overlayTop },
          ]}
        />
        <View
          style={[
            styles.overlayStrip,
            {
              bottom: 0,
              left: 0,
              right: 0,
              height: screenHeight - overlayTop - scanArea.height,
            },
          ]}
        />
        <View
          style={[
            styles.overlayStrip,
            {
              top: overlayTop,
              left: 0,
              width: overlayLeft,
              height: scanArea.height,
            },
          ]}
        />
        <View
          style={[
            styles.overlayStrip,
            {
              top: overlayTop,
              right: 0,
              width: screenWidth - overlayLeft - scanArea.width,
              height: scanArea.height,
            },
          ]}
        />
      </View>
      <View
        pointerEvents="none"
        style={[styles.overlay, { top: overlayTop, left: overlayLeft }]}
      >
        <View
          style={{
            width: scanArea.width,
            height: scanArea.height,
            position: "relative",
          }}
        >
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
      </View>
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  overlayStrip: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  overlayText: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  overlay: {
    position: "absolute",
  },
  corner: {
    position: "absolute",
    width: 50,
    height: 50,
    borderColor: Colors["light"].primary[300],
  },
  topLeft: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4 },
  topRight: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4 },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
});
