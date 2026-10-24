import { useEffect, useMemo, useRef } from "react";
import {
  FlatList,
  View,
  StyleSheet,
  useColorScheme,
  Dimensions,
} from "react-native";
import type { SkinConcernOut, SkinSessionOut } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { dayEntries } from "@/utils/skin-sessions";
import SkinJournalCard from "./skin-journal-card";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 64;
const CARD_GAP = 16;

interface SkinEntryPagerProps {
  sessions: SkinSessionOut[];
  concerns: SkinConcernOut[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onPhotoPress: (session: SkinSessionOut) => void;
  onViewMorePress: (session: SkinSessionOut) => void;
}

export default function SkinEntryPager({
  sessions,
  concerns,
  currentIndex,
  onIndexChange,
  onPhotoPress,
  onViewMorePress,
}: SkinEntryPagerProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const flatListRef = useRef<FlatList>(null);

  const entriesBySession = useMemo(() => {
    const map = new Map<number, ReturnType<typeof dayEntries>>();
    for (const session of sessions) {
      map.set(session.id, dayEntries(session.id, concerns));
    }
    return map;
  }, [sessions, concerns]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      onIndexChange(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  // Follows external index changes (day switch resets to the first entry).
  // Swipe-driven changes report the same index back, so this is a no-op then.
  useEffect(() => {
    if (
      sessions.length > 1 &&
      currentIndex >= 0 &&
      currentIndex < sessions.length
    ) {
      try {
        flatListRef.current?.scrollToIndex({
          index: currentIndex,
          animated: false,
        });
      } catch {
        // Layout not ready yet, swipe state stays correct.
      }
    }
  }, [currentIndex, sessions.length]);

  if (sessions.length <= 1) {
    const only = sessions[0];
    if (!only) return null;
    return (
      <View style={[styles.page, { width: CARD_WIDTH }]}>
        <SkinJournalCard
          session={only}
          entries={entriesBySession.get(only.id) ?? []}
          onPhotoPress={() => onPhotoPress(only)}
          onViewMorePress={() => onViewMorePress(only)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={sessions}
        keyExtractor={(item: SkinSessionOut) => item.id.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToAlignment="center"
        snapToInterval={CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        getItemLayout={(_: any, index: number) => ({
          length: CARD_WIDTH + CARD_GAP,
          offset: (CARD_WIDTH + CARD_GAP) * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }: { item: SkinSessionOut }) => (
          <View style={[styles.page, { width: CARD_WIDTH }]}>
            <SkinJournalCard
              session={item}
              entries={entriesBySession.get(item.id) ?? []}
              onPhotoPress={() => onPhotoPress(item)}
              onViewMorePress={() => onViewMorePress(item)}
            />
          </View>
        )}
      />
      <View style={styles.dots}>
        {sessions.map((session, index) => (
          <View
            key={session.id}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    width: "100%",
  },
  listContent: {
    paddingHorizontal: 32,
    gap: CARD_GAP,
  },
  page: {
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
