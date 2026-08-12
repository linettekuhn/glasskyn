import { useRef } from "react";
import {
  FlatList,
  View,
  StyleSheet,
  useColorScheme,
  Dimensions,
} from "react-native";
import type { Routine, Product } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import RoutineCard from "./routine-card";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 64;
const CARD_GAP = 16;

interface RoutinePagerProps {
  routines: Routine[];
  productMap: Map<number, Product>;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onCompletionChange?: () => void;
}

export default function RoutinePager({
  routines,
  productMap,
  currentIndex,
  onIndexChange,
  onCompletionChange,
}: RoutinePagerProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      onIndexChange(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={routines}
        keyExtractor={(item: Routine) => item.id.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToAlignment="center"
        snapToInterval={CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }: { item: Routine }) => (
          <View style={[styles.page, { width: CARD_WIDTH }]}>
            <RoutineCard
              routine={item}
              productMap={productMap}
              onCompletionChange={onCompletionChange}
            />
          </View>
        )}
      />
      {routines.length > 1 && (
        <View style={styles.dots}>
          {routines.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index === currentIndex
                      ? colors.secondary[600]
                      : colors.neutral[400],
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  listContent: {
    paddingHorizontal: 32,
    gap: CARD_GAP,
  },
  page: {
    height: "100%",
    justifyContent: "flex-end",
  },
  dots: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
