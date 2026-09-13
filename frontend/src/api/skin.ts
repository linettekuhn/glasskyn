import apiClient from "./client";
import { getPresignedUrl, uploadToS3 } from "./uploads";
import type {
  SkinCheckInPayload,
  SkinCheckInResponse,
  SkinSessionOut,
} from "@/types";

async function uploadSkinPhoto(uri: string): Promise<string> {
  const fileName = `skin_${Date.now()}.jpg`;
  const { upload_url, file_key } = await getPresignedUrl(
    fileName,
    "image/jpeg",
    "skin",
  );
  const response = await fetch(uri);
  const blob = await response.blob();
  await uploadToS3(upload_url, blob, "image/jpeg");
  return file_key;
}

export async function submitSkinCheckIn(
  payload: SkinCheckInPayload,
): Promise<SkinCheckInResponse> {
  const imageFileKey = payload.photo_uri
    ? await uploadSkinPhoto(payload.photo_uri)
    : "";
  const response = await apiClient.post("/skin/check-in", {
    image_file_key: imageFileKey,
    captured_at: payload.captured_at,
    face_landmarks: payload.face_landmarks,
    concerns: payload.concerns,
  });
  return response.data;
}

export async function getSkinSessions(): Promise<SkinSessionOut[]> {
  const response = await apiClient.get("/skin/sessions");
  return response.data;
}

export async function deleteSkinData(): Promise<void> {
  await apiClient.delete("/skin/data");
}