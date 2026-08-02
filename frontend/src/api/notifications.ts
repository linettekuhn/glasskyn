import apiClient from "./client";

export interface Alert {
  id: number;
  alert_type: "expiry" | "routine_reminder" | "water";
  title: string | null;
  body: string | null;
  product_id: number | null;
  scheduled_for: string | null;
  sent_at: string | null;
  is_read: boolean;
  created_at: string | null;
}

export async function registerPushToken(token: string, platform?: string) {
  const response = await apiClient.post("/push-token", {
    token,
    platform: platform ?? null,
  });
  return response.data;
}

export async function unregisterPushToken(token: string) {
  await apiClient.delete("/push-token", { data: { token } });
}

export async function getAlerts(unreadOnly = false): Promise<Alert[]> {
  const response = await apiClient.get("/alerts", {
    params: unreadOnly ? { unread_only: true } : {},
  });
  return response.data;
}

export async function markAlertRead(alertId: number): Promise<Alert> {
  const response = await apiClient.patch(`/alerts/${alertId}/read`);
  return response.data;
}
