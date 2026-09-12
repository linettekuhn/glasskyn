import type { SkinCheckInPayload } from "@/types";

export async function submitSkinCheckIn(
  payload: SkinCheckInPayload,
): Promise<{ sessionId: string }> {
  if (__DEV__) {
    console.log(
      "[skin] batch submit (stub):",
      JSON.stringify(payload, null, 2),
    );
  }
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { sessionId: `stub-${Date.now()}` };
}