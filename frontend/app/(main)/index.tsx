import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";
import GlassSurface from "@/components/ui/glass-surface";
import { Colors, getTheme } from "@/constants/theme";
import MirrorAffirmationCard from "@/components/home/mirror-affirmation-card";
import { useAuth } from "@/contexts/AuthContext";
import { useHomeRoutine } from "@/hooks/use-home-routine";
import { ctaTimeOfDay } from "@/utils/routine-status";
import RoutineStatusCard from "@/components/routine/routine-status-card";
import WaterIntakeCard from "@/components/water-intake-card";
import SpfTile from "@/components/spf-tile";
import ExpiringSoonCard from "@/components/expiring/expiring-soon-card";
import EntryCards from "@/components/entry-cards";
import { router, useLocalSearchParams } from "expo-router";
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
  type LayoutChangeEvent,
} from "react-native";
import { useEffect, useState } from "react";
import Divider from "@/components/ui/divider";

function getGreeting(hour: number, firstName: string): string {
  if (hour >= 5 && hour < 12) return `Morning, ${firstName}`;
  if (hour >= 12 && hour < 17) return `Hey, ${firstName}`;
  if (hour >= 17 && hour < 22) return `Evening, ${firstName}`;
  return `Up late, ${firstName}?`;
}

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const { user } = useAuth();
  const { routine, status, loading } = useHomeRoutine();
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const greeting = firstName
    ? getGreeting(new Date().getHours(), firstName)
    : "Welcome";

  const openRoutine = () => router.navigate("/(main)/journal");

  // Status-card CTA: journal with routines focused and the AM/PM toggle
  // matching the slot the button refers to (e.g. "Start Night Routine"
  // opens PM even in the morning); falls back to the current hour when the
  // button refers to no slot.
  const openRoutineJournal = () => {
    // TEMP-DIAG: trace what slot is sent to journal.
    console.log(
      "[JOURNAL-LINK] key=",
      status?.key,
      "sending timeOfDay=",
      (status ? ctaTimeOfDay(status.key) : null) ??
        (new Date().getHours() >= 12 ? "PM" : "AM"),
    );
    return router.navigate({
      pathname: "/(main)/journal",
      params: {
        tab: "routines",
        timeOfDay:
          (status ? ctaTimeOfDay(status.key) : null) ??
          (new Date().getHours() >= 12 ? "PM" : "AM"),
      },
    });
  };

  // Notification deep-link: pulse the SPF tile once, then consume the param
  // so returning to the tab later doesn't re-pulse.
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const [spfHighlight, setSpfHighlight] = useState(false);
  const [contentH, setContentH] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  const canScroll = contentH - viewportH > 1;
  useEffect(() => {
    if (focus === "spf") {
      setSpfHighlight(true);
      router.setParams({ focus: undefined });
    }
  }, [focus]);

  return (
    <View
      style={{ flex: 1 }}
      onLayout={(e: LayoutChangeEvent) =>
        setViewportH(e.nativeEvent.layout.height)
      }
    >
      <ScrollView
        contentContainerStyle={styles.container}
        onContentSizeChange={(_w: number, h: number) => setContentH(h)}
        scrollEnabled={canScroll}
        showsVerticalScrollIndicator={canScroll}
      >
        <View style={styles.header}>
          <ThemedText type="h1" style={{ color: colors.text }}>
            {greeting}
          </ThemedText>
        </View>
        <ExpiringSoonCard />
        <MirrorAffirmationCard />
        <Divider style={{ marginVertical: 6 }}>
          <ThemedText
            type="overline"
            style={{
              paddingHorizontal: 16,
              color: colors.neutral[600],
              letterSpacing: 1.2,
            }}
          >
            daily skin rituals
          </ThemedText>
        </Divider>
        <View style={{ gap: 12 }}>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.neutral[700]} />
            </View>
          ) : routine === null ? (
            <GlassSurface style={styles.emptyCard}>
              <ThemedText type="bodyLarge" weight="semiBold">
                No routine yet
              </ThemedText>
              <ThemedText type="caption" style={{ color: colors.neutral[600] }}>
                Build one to start tracking your daily steps
              </ThemedText>
              <ThemedButton
                text="Build Routine"
                onPress={openRoutine}
                alignment="flex-start"
              />
            </GlassSurface>
          ) : status ? (
            <RoutineStatusCard
              status={status}
              routineName={routine.name}
              onPressCta={openRoutineJournal}
            />
          ) : null}
          <View style={styles.tileRow}>
            <View style={{ flex: 1 }}>
              <WaterIntakeCard />
            </View>
            <View style={{ flex: 1 }}>
              <SpfTile highlight={spfHighlight} />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 6,
  },
  header: {
    gap: 8,
    marginBottom: 4,
  },
  body: {
    gap: 12,
  },
  tileRow: {
    flexDirection: "row",
    gap: 12,
  },
  loadingRow: {
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyCard: {
    padding: 20,
    gap: 8,
  },
});
