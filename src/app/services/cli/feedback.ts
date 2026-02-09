import { requestAppServer } from "@/app/services/cli/rpc";

export interface FeedbackUploadResponse {
  threadId: string;
}

export async function uploadFeedback(params: {
  classification: string;
  includeLogs: boolean;
  reason?: string | null;
  threadId?: string | null;
}) {
  const result = await requestAppServer<FeedbackUploadResponse>({
    method: "feedback/upload",
    params: {
      classification: params.classification,
      includeLogs: params.includeLogs,
      reason: params.reason ?? null,
      threadId: params.threadId ?? null,
    },
  });
  if (!result) {
    throw new Error("feedback/upload returned no result");
  }
  return result;
}
