import {
  View,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { useState, useCallback, useEffect } from "react";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getPushToken } from "@/services/notifications";
import { getAlerts, markAlertRead, sendDevTestPush } from "@/api/notifications";
import type { Alert } from "@/api/notifications";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPushToken()
      .then((token) => {
        if (!cancelled) setPushToken(token);
      })
      .catch(() => {
        if (!cancelled) setPushToken(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getAlerts();
      setAlerts(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const markRead = async (alert: Alert) => {
    if (alert.is_read) return;
    setAlerts((prev) =>
      prev.map((a) => (a.id === alert.id ? { ...a, is_read: true } : a)),
    );
    try {
      await markAlertRead(alert.id);
    } catch {
      refetch();
    }
  };

  const sendTest = async () => {
    setSending(true);
    try {
      await sendDevTestPush("direct");
      refetch();
    } catch {
      // handled by api client toast
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top", "bottom"]}
    >
      <View
        style={[styles.header, { borderBottomColor: colors.neutral[200] }]}
      >
        <ThemedText type="h2">Notifications</ThemedText>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Close notifications"
          style={styles.closeButton}
        >
          <MaterialCommunityIcons
            name="close"
            size={24}
            color={colors.primary[700]}
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary[600]} />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <ThemedText type="bodyLarge" style={{ color: colors.neutral[600] }}>
            Couldn't load notifications
          </ThemedText>
          <TouchableOpacity onPress={refetch}>
            <ThemedText type="body" style={{ color: colors.primary[600] }}>
              Try again
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : alerts.length === 0 ? (
        <View style={styles.centerState}>
          <MaterialCommunityIcons
            name="bell-outline"
            size={56}
            color={colors.neutral[400]}
          />
          <ThemedText type="bodyLarge" style={{ color: colors.neutral[600] }}>
            No notifications yet
          </ThemedText>
          <ThemedText
            type="bodySmall"
            style={{ color: colors.neutral[500], textAlign: "center" }}
          >
            We'll let you know when something needs your attention.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item: Alert) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: 1,
                backgroundColor: colors.neutral[200],
                marginLeft: 20,
              }}
            />
          )}
          renderItem={({ item }: { item: Alert }) => (
            <TouchableOpacity
              style={styles.alertRow}
              onPress={() => markRead(item)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.unreadDot,
                  item.is_read && { backgroundColor: "transparent" },
                ]}
              />
              <View style={styles.alertBody}>
                <ThemedText
                  type="bodyLarge"
                  weight={item.is_read ? "regular" : "semiBold"}
                >
                  {item.title}
                </ThemedText>
                {!!item.body && (
                  <ThemedText
                    type="bodySmall"
                    style={{ color: colors.neutral[600] }}
                  >
                    {item.body}
                  </ThemedText>
                )}
                <ThemedText
                  type="captionSmall"
                  style={{ color: colors.neutral[500] }}
                >
                  {timeAgo(item.created_at)}
                </ThemedText>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {__DEV__ && (
        <View style={[styles.devPanel, { backgroundColor: colors.neutral[200] }]}>
          <ThemedText type="bodyLarge" weight="semiBold">
            Dev tools
          </ThemedText>
          <ThemedText
            type="captionSmall"
            style={{ color: colors.neutral[500] }}
          >
            {pushToken
              ? `Push token: ${pushToken.slice(0, 24)}…`
              : "No push token yet. Log in and grant permission."}
          </ThemedText>
          <TouchableOpacity
            onPress={sendTest}
            disabled={sending || !pushToken}
            style={[
              styles.devButton,
              { backgroundColor: colors.primary[600] },
              (sending || !pushToken) && { opacity: 0.5 },
            ]}
          >
            <ThemedText type="body" weight="semiBold" style={{ color: "#fff" }}>
              {sending ? "Sending…" : "Send test notification"}
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  listContent: {
    paddingVertical: 8,
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    backgroundColor: "#6c63ff",
  },
  alertBody: {
    flex: 1,
    gap: 2,
  },
  devPanel: {
    margin: 20,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  devButton: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
