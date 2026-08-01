import apiClient from "./client";
import type { SkinProfile, Routine, RoutineTemplate } from "../types";

export async function getSkinProfile(): Promise<SkinProfile> {
  const response = await apiClient.get("/routines/skin-profile");
  return response.data;
}

export async function upsertSkinProfile(data: {
  skin_type?: string;
  is_sensitive?: boolean | null;
  concerns?: string[];
  goals?: string[];
}): Promise<SkinProfile> {
  const response = await apiClient.put("/routines/skin-profile", data);
  return response.data;
}

export async function createRoutine(data: {
  name: string;
  source?: string;
  routine_type?: string;
  steps?: {
    step_order: number;
    product_id?: number | null;
    step_type: string;
    time_of_day: string;
    frequency?: string;
  }[];
}): Promise<Routine> {
  const response = await apiClient.post("/routines", data);
  return response.data;
}

export async function listRoutines(
  routineType = "skincare",
): Promise<Routine[]> {
  const response = await apiClient.get("/routines", {
    params: { routine_type: routineType },
  });
  return response.data;
}

export async function getActiveRoutine(
  routineType = "skincare",
): Promise<Routine> {
  const response = await apiClient.get("/routines/active", {
    params: { routine_type: routineType },
  });
  return response.data;
}

export async function getRoutine(id: number): Promise<Routine> {
  const response = await apiClient.get(`/routines/${id}`);
  return response.data;
}

export async function updateRoutine(
  id: number,
  data: {
    name?: string;
    is_active?: boolean;
    steps?: {
      step_order: number;
      product_id?: number | null;
      step_type: string;
      time_of_day: string;
      frequency?: string;
    }[];
  },
): Promise<Routine> {
  const response = await apiClient.patch(`/routines/${id}`, data);
  return response.data;
}

export async function deleteRoutine(id: number): Promise<void> {
  await apiClient.delete(`/routines/${id}`);
}

export async function updateRoutineStep(
  routineId: number,
  stepId: number,
  data: {
    step_order?: number;
    product_id?: number | null;
    step_type?: string;
    time_of_day?: string;
    frequency?: string;
  },
): Promise<void> {
  await apiClient.patch(`/routines/${routineId}/steps/${stepId}`, data);
}

export async function markStepComplete(
  routineId: number,
  stepId: number,
): Promise<void> {
  await apiClient.patch(`/routines/${routineId}/steps/${stepId}/complete`);
}

export async function listTemplates(
  routineType = "skincare",
  skinType?: string,
  concern?: string,
): Promise<RoutineTemplate[]> {
  const params: Record<string, string> = { routine_type: routineType };
  if (skinType) params.skin_type = skinType;
  if (concern) params.concern = concern;
  const response = await apiClient.get("/routines/templates", { params });
  return response.data;
}

export async function getTemplate(id: number): Promise<RoutineTemplate> {
  const response = await apiClient.get(`/routines/templates/${id}`);
  return response.data;
}

export async function cloneTemplate(
  templateId: number,
  name?: string,
): Promise<Routine> {
  const response = await apiClient.post("/routines/clone", {
    template_id: templateId,
    name,
  });
  return response.data;
}

export async function getSuggestedTemplates(): Promise<RoutineTemplate[]> {
  const response = await apiClient.get("/routines/suggested");
  return response.data;
}
