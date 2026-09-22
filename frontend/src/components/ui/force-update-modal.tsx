import { Linking, StyleSheet, View, useColorScheme } from "react-native";
import { Colors } from "@/constants/theme";
import GlasskynLogo from "../icons/glasskyn-logo";
import { ThemedText } from "./themed-text";
import ThemedButton from "./themed-button";

interface Props {
  storeUrl: string;
}

export default function ForceUpdateModal({ storeUrl }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <GlasskynLogo width={140} height={58} />

        <ThemedText
          type="h2"
          weight="semiBold"
          style={styles.title}
        >
          Update Required
        </ThemedText>

        <ThemedText
          type="body"
          style={styles.description}
        >
          A new version of Glasskyn is available. Please update to continue
          using the app.
        </ThemedText>

        <ThemedButton
          text="Update Now"
          onPress={() => Linking.openURL(storeUrl)}
          alignment="stretch"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  content: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: 24,
  },
  title: {
    textAlign: "center",
    marginTop: 8,
  },
  description: {
    textAlign: "center",
    opacity: 0.7,
    marginBottom: 8,
  },
});
