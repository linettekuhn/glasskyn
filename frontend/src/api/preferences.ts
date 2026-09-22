import apiClient from "./client";
import type { UserPreference } from "../types";

export async function getPreferences(): Promise<UserPreference> {
  const response = await apiClient.get("/preferences");
  return response.data;
}

export async function savePreferences(
  data: Partial<UserPreference>,
): Promise<UserPreference> {
  const response = await apiClient.put("/preferences", data);
  return response.data;
}
