import apiClient from "./client";

interface PresignedUrlResponse {
  upload_url: string;
  file_key: string;
  public_url: string;
}

export async function getPresignedUrl(
  fileName: string,
  contentType: string
): Promise<PresignedUrlResponse> {
  console.log("[API] getPresignedUrl called:", fileName, contentType);
  const response = await apiClient.post("/uploads/presigned-url", {
    file_name: fileName,
    content_type: contentType,
  });
  console.log("[API] getPresignedUrl response:", response.data);
  return response.data;
}

export async function uploadToS3(
  url: string,
  blob: Blob,
  contentType: string
): Promise<void> {
  console.log("[API] uploadToS3 called, blob size:", blob.size);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const result = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: blob,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    console.log("[API] uploadToS3 response status:", result.status);
    
    if (!result.ok) {
      const errorText = await result.text();
      console.error("[API] uploadToS3 error:", errorText);
      throw new Error(`S3 upload failed: ${result.status} - ${errorText}`);
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error("[API] uploadToS3 error:", err);
    if (err.name === "AbortError") {
      throw new Error("S3 upload timed out after 30 seconds");
    }
    throw err;
  }
}