import { Colors, Fonts, getTheme } from "@/constants/theme";
import { MaterialCommunityIcons, Octicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import {
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import TopBar from "@/components/top-bar";
import GradientBackground from "@/components/ui/gradient-background";
import GlassSurface from "@/components/ui/glass-surface";

type TabBarIconProps = { focused: boolean; color: string };

type TabIconProps = TabBarIconProps & {
  IconComponent: React.ComponentType<any>;
  outlineName: string;
  fillName: string;
  size: number;
};

const TAB_TRANSITION_DURATION = 350;
const TAB_SLIDE_FRACTION = 0.5;

const TabIcon = (props: TabIconProps) => {
  const IconComponent = props.IconComponent;
  const outlineName = props.outlineName;
  const fillName = props.fillName;
  const size = props.size;
  const color = props.color;
  const focused = props.focused;

  return focused ? (
    <IconComponent name={fillName} size={size} color={color} />
  ) : (
    <IconComponent name={outlineName} size={size} color={color} />
  );
};

export default function MainLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const inactiveColor = colors.neutral[500];
  const focusedColor = colors.primary[500];
  const strokeColor = colors.neutral[200];
  const { width } = useWindowDimensions();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientBackground />
      <TopBar />
      <SafeAreaView style={{ flex: 1 }} edges={["bottom", "left", "right"]}>
        <Tabs
          screenOptions={{
            sceneStyle: { backgroundColor: "transparent" },
            headerShown: false,
            lazy: true,
            freezeOnBlur: true,
            transitionSpec: {
              animation: "timing",
              config: { duration: TAB_TRANSITION_DURATION },
            },
            sceneStyleInterpolator: ({ current }) => ({
              sceneStyle: {
                opacity: current.progress.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: [0, 1, 0],
                }),
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: [
                        -width * TAB_SLIDE_FRACTION,
                        0,
                        width * TAB_SLIDE_FRACTION,
                      ],
                    }),
                  },
                ],
              },
            }),
            tabBarActiveTintColor: focusedColor,
            tabBarInactiveTintColor: inactiveColor,
            tabBarStyle: {
              backgroundColor: "transparent",
              borderTopWidth: 1,
              borderTopColor: strokeColor,
              height: 65,
            },
            tabBarLabelStyle: {
              fontFamily: Fonts.sansMedium,
              fontSize: 14,
            },
            tabBarIconStyle: {
              marginTop: 8,
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: "Home",
              tabBarIcon: ({ focused, color }: TabBarIconProps) => (
                <TabIcon
                  IconComponent={MaterialCommunityIcons}
                  outlineName="home-variant-outline"
                  fillName="home-variant"
                  size={28}
                  color={color}
                  focused={focused}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="products"
            options={{
              title: "Vanity",
              tabBarIcon: ({ focused, color }: TabBarIconProps) => (
                <TabIcon
                  IconComponent={MaterialCommunityIcons}
                  outlineName="archive-outline"
                  fillName="archive"
                  size={28}
                  color={color}
                  focused={focused}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="scanner"
            options={{
              title: "Scanner",
              tabBarIcon: ({ focused, color }: TabBarIconProps) => (
                <TabIcon
                  IconComponent={MaterialCommunityIcons}
                  outlineName="cube-scan"
                  fillName="scan-helper"
                  size={28}
                  color={color}
                  focused={focused}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="chat"
            options={{
              title: "Cur.ai",
              tabBarIcon: ({ focused, color }: TabBarIconProps) => (
                <TabIcon
                  IconComponent={MaterialCommunityIcons}
                  outlineName="chat-outline"
                  fillName="chat"
                  size={28}
                  color={color}
                  focused={focused}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="journal"
            options={{
              title: "Journal",
              tabBarIcon: ({ focused, color }: TabBarIconProps) => (
                <TabIcon
                  IconComponent={MaterialCommunityIcons}
                  outlineName="notebook-heart-outline"
                  fillName="notebook-heart"
                  size={28}
                  color={color}
                  focused={focused}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              href: null,
            }}
          />
        </Tabs>
      </SafeAreaView>
    </View>
  );
}
