import { Colors, Fonts, getTheme } from "@/constants/theme";
import { MaterialCommunityIcons, Octicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Text, StyleSheet, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TabIcon = (props: any) => {
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
  const inactiveColor = colors.primary[600];
  const focusedColor = colors.primary[800];
  const bgColor = colors.neutral[100];
  const strokeColor = colors.primary[200];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: focusedColor,
          tabBarInactiveTintColor: inactiveColor,
          tabBarStyle: {
            backgroundColor: bgColor,
            borderTopWidth: 1,
            borderTopColor: strokeColor,
            height: 60,
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
            tabBarIcon: ({ focused, color }) => (
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
          name="routine"
          options={{
            title: "My Routine",
            tabBarIcon: ({ focused, color }) => (
              <TabIcon
                IconComponent={MaterialCommunityIcons}
                outlineName="clipboard-list-outline"
                fillName="clipboard-list"
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
            tabBarIcon: ({ focused, color }) => (
              <TabIcon
                IconComponent={MaterialCommunityIcons}
                outlineName="qrcode-scan"
                fillName="scan-helper"
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
            title: "My Shelf",
            tabBarIcon: ({ focused, color }) => (
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
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ focused, color }) => (
              <TabIcon
                IconComponent={MaterialCommunityIcons}
                outlineName="face-man-shimmer-outline"
                fillName="face-man-shimmer"
                size={28}
                color={color}
                focused={focused}
              />
            ),
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 22,
  },
});
