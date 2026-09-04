import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";
import GlassSurface from "@/components/ui/glass-surface";
import { Colors, getTheme } from "@/constants/theme";
import { affirmations } from "@/constants/affirmations";
import { useAuth } from "@/contexts/AuthContext";
import { useHomeRoutine } from "@/hooks/use-home-routine";
import RoutineStatusCard from "@/components/routine/routine-status-card";
import WaterIntakeCard from "@/components/water-intake-card";
import ExpiringSoonCard from "@/components/expiring/expiring-soon-card";
import EntryCards from "@/components/entry-cards";
import { router } from "expo-router";
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
} from "react-native";

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
  const affirmation =
    affirmations[Math.floor(Date.now() / 86400000) % affirmations.length];

  const openRoutine = () => router.navigate("/(main)/routine");

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="h1" style={{ color: colors.text }}>
          {greeting}
        </ThemedText>
        <ThemedText
          type="bodyLarge"
          italic
          style={{ color: colors.neutral[600] }}
        >
          "{affirmation}"
        </ThemedText>
      </View>

      <ExpiringSoonCard />

      <ScrollView contentContainerStyle={styles.body}>
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
            onPressCta={openRoutine}
          />
        ) : null}
        <WaterIntakeCard />
        <EntryCards />
        {__DEV__ && (
          <ThemedButton
            outlined
            text="Dev: Skin face-detection test"
            onPress={() => router.navigate("/(modals)/skin-face-test")}
            alignment="flex-start"
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 8,
  },
  header: {
    gap: 8,
  },
  body: {
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
