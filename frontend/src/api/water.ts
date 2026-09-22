import apiClient from "./client";
import type { WaterIntake } from "@/types";

export function localDate(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export async function getWaterIntake(date?: string): Promise<WaterIntake> {
  const params: Record<string, string> = { on_date: date ?? localDate() };
  const response = await apiClient.get("/water/intake", { params });
  return response.data;
}

export async function setWaterIntake(
  ml: number,
  date?: string,
): Promise<WaterIntake> {
  const response = await apiClient.post("/water/intake", {
    date: date ?? localDate(),
    ml,
  });
  return response.data;
}
