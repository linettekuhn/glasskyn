import apiClient from "./client";
import type { Routine } from "../types";

export interface ChatMessageOut {
  id: number;
  session_id: string;
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls: unknown[] | null;
  tool_call_id: string | null;
  created_at: string;
}

export interface ChatResponse {
  session_id: string;
  messages: ChatMessageOut[];
}

export async function sendMessage(
  sessionId: string,
  message: string,
  timeout?: number,
): Promise<ChatResponse> {
  const config = timeout ? { timeout } : {};
  const response = await apiClient.post("/chat", {
    session_id: sessionId,
    message,
  }, config);
  return response.data;
}

export async function getMessages(
  sessionId: string,
): Promise<ChatMessageOut[]> {
  const response = await apiClient.get(`/chat/${sessionId}/messages`);
  return response.data;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/chat/${sessionId}`);
}

export async function generateRoutine(): Promise<Routine> {
  const response = await apiClient.post("/routines/generate");
  return response.data;
}
