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
  source: unknown;
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

export async function listThreads(
  params: {
    cursor?: string | null;
    limit?: number;
    archived?: boolean;
    modelProviders?: string[];
    sourceKinds?: string[];
  } = {},
): Promise<ThreadListResponse> {
  const response = await sendAppServerRequest<ThreadListResponse>({
    id: requestId(),
    method: "thread/list",
    params: {
      cursor: params.cursor ?? null,
      limit: params.limit ?? 25,
      sortKey: "updated_at",
      archived: params.archived ?? null,
      modelProviders:
        params.modelProviders && params.modelProviders.length
          ? params.modelProviders
          : null,
      sourceKinds:
        params.sourceKinds && params.sourceKinds.length
          ? params.sourceKinds
          : null,
    },
  });
  if (response.error) {
    throw new Error(response.error.message);
  }
  return (
    response.result ?? {
      data: [],
      nextCursor: null,
    }
  );
}

export async function readThread(threadId: string, includeTurns = false) {
  const response = await sendAppServerRequest<ThreadReadResponse>({
    id: requestId(),
    method: "thread/read",
    params: {
      threadId,
      includeTurns,
    },
  });
  if (response.error) {
    throw new Error(response.error.message);
  }
  return response.result?.thread;
}

export async function archiveThread(threadId: string) {
  const response = await sendAppServerRequest({
    id: requestId(),
    method: "thread/archive",
    params: {
      threadId,
    },
  });
  if (response.error) {
    throw new Error(response.error.message);
  }
  return response.result;
}

export async function unarchiveThread(threadId: string) {
  const response = await sendAppServerRequest({
    id: requestId(),
    method: "thread/unarchive",
    params: {
      threadId,
    },
  });
  if (response.error) {
    throw new Error(response.error.message);
  }
  return response.result;
}
