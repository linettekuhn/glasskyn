import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { registerPushToken, unregisterPushToken } from "../api/notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let cachedPushToken: string | null = null;

export async function getExpoPushToken(): Promise<string | null> {
  if (cachedPushToken) {
    return cachedPushToken;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId:
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId,
  });
  cachedPushToken = tokenData.data;
  return cachedPushToken;
}

export async function getPushToken(): Promise<string | null> {
  if (cachedPushToken) {
    return cachedPushToken;
  }
  return getExpoPushToken();
}

export function setupNotificationListeners(): () => void {
  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener(() => {
      router.push("/(modals)/notifications");
    });

  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) {
        router.push("/(modals)/notifications");
      }
    })
    .catch(() => {});

  return () => {
    responseSubscription.remove();
  };
}

export async function registerPushNotificationsWithBackend(): Promise<void> {
  try {
    const token = await getExpoPushToken();
    if (!token) {
      return;
    }
    await registerPushToken(token, Platform.OS);
  } catch (error) {
    console.warn("[notifications] Failed to register push token", error);
  }
}

export async function unregisterPushNotificationsFromBackend(): Promise<void> {
  if (!cachedPushToken) {
    return;
  }
  try {
    await unregisterPushToken(cachedPushToken);
  } catch (error) {
    console.warn("[notifications] Failed to unregister push token", error);
  } finally {
    cachedPushToken = null;
  }
}
