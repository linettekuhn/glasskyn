import { View, StyleSheet, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ui/themed-text";
import { Colors, getTheme } from "@/constants/theme";
import ThemedButton from "@/components/ui/themed-button";

export default function WelcomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.neutral[100] }]}>
      <View style={styles.content}>
        <View style={styles.heading}>
          <ThemedText type="h1" style={{ textAlign: "center" }}>
            Let's get to know your skin
          </ThemedText>
          <ThemedText
            type="bodyLarge"
            style={{ textAlign: "center", color: colors.secondary[600] }}
          >
            A few quick questions so we can recommend the right products and
            routines for you.
          </ThemedText>
        </View>
        <ThemedButton
          text="Get Started"
          onPress={() => router.push("/(onboarding)/skin-type")}
          color={colors.primary[600]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 32,
    gap: 40,
  },
  heading: {
    gap: 16,
  },
});
