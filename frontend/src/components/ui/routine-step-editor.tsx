import {
  View,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Colors, getTheme } from "@/constants/theme";
import { STEP_LABELS, FREQUENCY_LABELS } from "@/constants/routine";
import type { StepDisplay } from "@/types";
import { ThemedText } from "./themed-text";
import ThemedButton from "./themed-button";
import LoadingSpinner from "./loading-spinner";
import { MaterialIcons } from "@expo/vector-icons";
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from "react-native-draggable-flatlist";
import { ScrollView } from "react-native-gesture-handler";

interface RoutineStepEditorProps {
  title: string;
  subtitle: string;
  steps: StepDisplay[];
  loading: boolean;
  notFound?: boolean;
  notFoundMessage?: string;
  productPickerReturnTo: string;
  productPickerExtraParam?: { key: string; value: string };
  onDragEnd: (timeOfDay: "AM" | "PM", newOrder: StepDisplay[]) => void;
  bottomBar?: React.ReactNode;
  onDeleteStep?: (id: number) => void;
  onGoBack?: () => void;
  headerContent?: React.ReactNode;
  onAddStep?: (timeOfDay: "AM" | "PM") => void;
}

export default function RoutineStepEditor({
  title,
  subtitle,
  steps,
  loading,
  notFound,
  notFoundMessage,
  productPickerReturnTo,
  productPickerExtraParam,
  onDragEnd,
  bottomBar,
  onDeleteStep,
  headerContent,
  onGoBack,
  onAddStep,
}: RoutineStepEditorProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (notFound) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.neutral[100] }]}
        edges={["top", "bottom"]}
      >
        <View style={styles.center}>
          <ThemedText type="bodyLarge">
            {notFoundMessage ?? "Not found"}
          </ThemedText>
          <ThemedButton text="Go Back" link onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const morningSteps = steps.filter((s) => s.time_of_day === "AM");
  const nightSteps = steps.filter((s) => s.time_of_day === "PM");

  const renderStep = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<StepDisplay>) => {
    const hasProduct = item.product_id !== null;
    return (
      <ScaleDecorator>
        <TouchableOpacity
          onLongPress={drag}
          disabled={isActive}
          style={[
            styles.stepRow,
            {
              borderColor: colors.neutral[300],
              backgroundColor: isActive
                ? colors.primary[100]
                : colors.background,
            },
          ]}
        >
          <TouchableOpacity onLongPress={drag} disabled={isActive}>
            <MaterialIcons name="list" size={24} color={colors.neutral[500]} />
          </TouchableOpacity>

          <View style={styles.stepContent}>
            <ThemedText type="body">
              {STEP_LABELS[item.step_type] ?? item.step_type}
              {item.frequency ? ` ${FREQUENCY_LABELS[item.frequency]}` : ""}
              {hasProduct
                ? ` with ${item.product_name}`
                : " with no product found"}
            </ThemedText>
          </View>

          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/(modals)/product-picker",
                params: {
                  stepId: item.id,
                  stepType: item.step_type,
                  returnTo: productPickerReturnTo,
                  ...(productPickerExtraParam
                    ? {
                        [productPickerExtraParam.key]:
                          productPickerExtraParam.value,
                      }
                    : {}),
                },
              })
            }
          >
            <MaterialIcons
              name={hasProduct ? "edit" : "warning"}
              size={20}
              color={hasProduct ? colors.primary[600] : "#e65100"}
            />
          </TouchableOpacity>

          {onDeleteStep && (
            <TouchableOpacity onPress={() => onDeleteStep(item.id)}>
              <MaterialIcons
                name="delete-outline"
                size={20}
                color={colors.neutral[500]}
              />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  const renderSection = (
    label: string,
    icon: React.ReactNode,
    data: StepDisplay[],
    timeOfDay: "AM" | "PM",
  ) => {
    if (data.length === 0 && !onAddStep) return null;
    return (
      <View style={styles.section}>
        <ThemedText type="overline" weight="bold">
          {icon} {label}
        </ThemedText>
        {data.length > 0 && (
          <DraggableFlatList
            data={data}
            renderItem={renderStep}
            keyExtractor={(item) => item.id.toString()}
            onDragEnd={({ data }) => onDragEnd(timeOfDay, data)}
            scrollEnabled={false}
          />
        )}
        {onAddStep && (
          <ThemedButton
            link
            text="+ Add Step"
            textType="bodySmall"
            onPress={() => onAddStep(timeOfDay)}
            alignment="flex-start"
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.neutral[100] }]}
      edges={["top", "bottom"]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View>
          <ThemedButton
            link
            text="Go Back"
            leftIconName="arrow-back"
            LeftIconComponent={MaterialIcons}
            onPress={onGoBack ?? (() => router.back())}
            color={colors.neutral[800]}
            alignment="flex-start"
          />
          <ThemedText type="h1">{title}</ThemedText>
          <ThemedText type="bodyLarge" style={{ color: colors.secondary[600] }}>
            {subtitle}
          </ThemedText>
        </View>

        {headerContent}

        {renderSection(
          "morning steps",
          <MaterialIcons name="sunny" size={12} color={colors.text} />,
          morningSteps,
          "AM",
        )}

        {renderSection(
          "night steps",
          <MaterialIcons
            name="nightlight-round"
            size={12}
            color={colors.text}
          />,
          nightSteps,
          "PM",
        )}
      </ScrollView>

      {bottomBar && (
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.neutral[300],
            },
          ]}
        >
          {bottomBar}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    gap: 24,
    paddingBottom: 24,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  section: {
    gap: 8,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  stepContent: {
    flex: 1,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
});
