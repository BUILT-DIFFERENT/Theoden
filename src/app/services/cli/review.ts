import { requestAppServer } from "@/app/services/cli/rpc";

export type ReviewDelivery = "inline" | "detached";

export type ReviewTarget =
  | { type: "uncommittedChanges" }
  | { type: "baseBranch"; branch: string; title?: string }
  | { type: "commit"; sha: string; title?: string }
  | { type: "custom"; instructions: string; title?: string };

export interface ReviewStartResponse {
  turn: {
    id: string;
    status: string;
    items: unknown[];
    error: unknown;
  };
  reviewThreadId: string;
}

export async function startReview(params: {
  threadId: string;
  target: ReviewTarget;
  delivery?: ReviewDelivery | null;
}) {
  const result = await requestAppServer<ReviewStartResponse>({
    method: "review/start",
    params: {
      threadId: params.threadId,
      target: params.target,
      delivery: params.delivery ?? null,
    },
  });
  if (!result) {
    throw new Error("review/start returned no result");
  }
  return result;
}
