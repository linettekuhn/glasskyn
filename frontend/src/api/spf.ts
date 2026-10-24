import apiClient from "./client";
import type { SpfStatus } from "@/types";

export async function getSpfStatus(): Promise<SpfStatus> {
  const response = await apiClient.get("/spf/status");
  return response.data;
}

export async function applySpf(appliedAt: string): Promise<SpfStatus> {
  const response = await apiClient.post("/spf/apply", {
    applied_at: appliedAt,
  });
  return response.data;
}

export interface SpfUndoPayload {
  restore_at: string | null;
  remove_log_at?: string | null;
  restore_rows?: string[];
  clear_log_after?: string | null;
}

export async function undoSpf(payload: SpfUndoPayload): Promise<SpfStatus> {
  const response = await apiClient.post("/spf/undo", payload);
  return response.data;
}
