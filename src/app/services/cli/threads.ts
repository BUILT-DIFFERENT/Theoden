import { requestAppServer } from "@/app/services/cli/rpc";

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

export interface ThreadLoadedListResponse {
  data: string[];
  nextCursor?: string | null;
}

export interface ThreadRollbackResponse {
  thread: AppServerThread;
}

export type ThreadSortKey = "created_at" | "updated_at";

export async function listThreads(
  params: {
    cursor?: string | null;
    limit?: number;
    archived?: boolean;
    sortKey?: ThreadSortKey;
    modelProviders?: string[];
    sourceKinds?: string[];
  } = {},
): Promise<ThreadListResponse> {
  const result = await requestAppServer<ThreadListResponse>({
    method: "thread/list",
    params: {
      cursor: params.cursor ?? null,
      limit: params.limit ?? 25,
      sortKey: params.sortKey ?? "updated_at",
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
  return (
    result ?? {
      data: [],
      nextCursor: null,
    }
  );
}

export async function readThread(threadId: string, includeTurns = false) {
  const result = await requestAppServer<ThreadReadResponse>({
    method: "thread/read",
    params: {
      threadId,
      includeTurns,
    },
  });
  return result?.thread;
}

export async function archiveThread(threadId: string) {
  return requestAppServer({
    method: "thread/archive",
    params: {
      threadId,
    },
  });
}

export async function unarchiveThread(threadId: string) {
  return requestAppServer({
    method: "thread/unarchive",
    params: {
      threadId,
    },
  });
}

export async function forkThread(threadId: string) {
  const result = await requestAppServer<ThreadReadResponse>({
    method: "thread/fork",
    params: {
      threadId,
    },
  });
  return result?.thread;
}

export async function listLoadedThreads(params?: {
  cursor?: string | null;
  limit?: number;
}) {
  const result = await requestAppServer<ThreadLoadedListResponse>({
    method: "thread/loaded/list",
    params: {
      cursor: params?.cursor ?? null,
      limit: params?.limit ?? null,
    },
  });
  return (
    result ?? {
      data: [],
      nextCursor: null,
    }
  );
}

export async function rollbackThread(params: {
  threadId: string;
  numTurns: number;
}) {
  if (!Number.isInteger(params.numTurns) || params.numTurns < 1) {
    throw new Error("numTurns must be a positive integer.");
  }
  const result = await requestAppServer<ThreadRollbackResponse>({
    method: "thread/rollback",
    params: {
      threadId: params.threadId,
      numTurns: params.numTurns,
    },
  });
  return result?.thread;
}
