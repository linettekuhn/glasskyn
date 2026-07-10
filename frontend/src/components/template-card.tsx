import { Colors, getTheme } from "@/constants/theme";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from "react-native";
import { ThemedText } from "@/components/ui/themed-text";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { RoutineTemplate } from "@/types";

type Props = {
  template: RoutineTemplate;
  selectedTimeOfDay: "AM" | "PM";
  isRecommended: boolean;
  onPress: () => void;
};

const SKIN_TYPE_LABELS: Record<string, string> = {
  dry: "Dry",
  oily: "Oily",
  combination: "Combination",
  normal: "Normal",
  sensitive: "Sensitive",
};

export default function TemplateCard({
  template,
  selectedTimeOfDay,
  isRecommended,
  onPress,
}: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const amSteps = template.steps.filter(
    (s) => s.time_of_day === "AM",
  ).length;
  const pmSteps = template.steps.filter(
    (s) => s.time_of_day === "PM",
  ).length;
  const stepLabel =
    selectedTimeOfDay === "AM"
      ? `${amSteps} morning step${amSteps !== 1 ? "s" : ""}`
      : `${pmSteps} night step${pmSteps !== 1 ? "s" : ""}`;
  const filteredSteps = template.steps.filter(
    (step) => step.time_of_day === selectedTimeOfDay,
  );

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          borderColor: colors.neutral[600],
          backgroundColor: colors.background,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardTop}>
        <ThemedText type="h6">{template.name}</ThemedText>
        {isRecommended && (
          <View
            style={[
              styles.recommendedBadge,
              { backgroundColor: colors.secondary[200] },
            ]}
          >
            <MaterialCommunityIcons
              name="star"
              size={12}
              color={colors.secondary[700]}
            />
            <ThemedText
              type="captionSmall"
              style={{ color: colors.secondary[700] }}
              weight="semiBold"
            >
              Recommended
            </ThemedText>
          </View>
        )}
        <View>
          <ThemedText
            type="bodySmall"
            style={{ color: colors.neutral[700] }}
          >
            {stepLabel}
          </ThemedText>
          <ThemedText italic>
            {filteredSteps.map((step) => step.step_type).join(", ")}
          </ThemedText>
        </View>
        {((template.concern_tags && template.concern_tags.length > 0) ||
          (template.skin_type_tags &&
            template.skin_type_tags.length > 0)) && (
          <View
            style={[
              styles.divider,
              { backgroundColor: colors.neutral[200] },
            ]}
          />
        )}
        {template.concern_tags && template.concern_tags.length > 0 && (
          <View style={{ width: "100%" }}>
            <ThemedText
              type="overline"
              weight="semiBold"
              style={{ color: colors.neutral[700] }}
            >
              concerns targeted
            </ThemedText>
            <View style={styles.tagRow}>
              {template.concern_tags.map((tag) => (
                <View
                  key={tag}
                  style={[
                    styles.tag,
                    { backgroundColor: colors.primary[100] },
                  ]}
                >
                  <ThemedText
                    type="captionSmall"
                    style={{ color: colors.primary[700] }}
                  >
                    {SKIN_TYPE_LABELS[tag] || tag}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}
        {template.skin_type_tags && template.skin_type_tags.length > 0 && (
          <View style={{ width: "100%" }}>
            <ThemedText
              type="overline"
              weight="semiBold"
              style={{ color: colors.neutral[700] }}
            >
              compatible skin types
            </ThemedText>
            <View style={styles.tagRow}>
              {template.skin_type_tags.map((tag) => (
                <View
                  key={tag}
                  style={[
                    styles.tag,
                    { backgroundColor: colors.primary[100] },
                  ]}
                >
                  <ThemedText
                    type="captionSmall"
                    style={{ color: colors.primary[700] }}
                  >
                    {SKIN_TYPE_LABELS[tag] || tag}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color={colors.neutral[600]}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 8,
    gap: 4,
  },
  cardTop: {
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 2,
  },
  recommendedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  divider: {
    width: "100%",
    height: 1,
    marginVertical: 4,
  },
  chevron: {
    position: "absolute",
    right: 12,
    top: 12,
  },
});
