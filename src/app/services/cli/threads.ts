import { sendAppServerRequest } from "@/app/services/cli/appServer";

export interface AppServerThread {
  id: string;
  preview: string;
  modelProvider: string;
  createdAt: number;
  updatedAt: number;
  path: string | null;
  cwd: string;
  cliVersion: string;
  source: string;
  gitInfo: { branch?: string } | null;
  turns?: unknown[];
}

export interface ThreadListResponse {
  data: AppServerThread[];
  nextCursor: string | null;
}

export interface ThreadReadResponse {
  thread: AppServerThread;
}

function requestId() {
  return Math.floor(Date.now() + Math.random() * 1000);
}

export async function listThreads(params: { cursor?: string | null; limit?: number } = {}) {
  const response = await sendAppServerRequest<ThreadListResponse>({
    id: requestId(),
    method: "thread/list",
    params: {
      cursor: params.cursor ?? null,
      limit: params.limit ?? 25,
      sortKey: "updated_at"
    }
  });
  if (response.error) {
    throw new Error(response.error.message);
  }
  return response.result?.data ?? [];
}

export async function readThread(threadId: string, includeTurns = false) {
  const response = await sendAppServerRequest<ThreadReadResponse>({
    id: requestId(),
    method: "thread/read",
    params: {
      threadId,
      includeTurns
    }
  });
  if (response.error) {
    throw new Error(response.error.message);
  }
  return response.result?.thread;
}
