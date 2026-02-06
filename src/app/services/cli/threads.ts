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

export async function listThreads(
  params: {
    cursor?: string | null;
    limit?: number;
    archived?: boolean;
    modelProviders?: string[];
    sourceKinds?: string[];
  } = {},
): Promise<ThreadListResponse> {
  const result = await requestAppServer<ThreadListResponse>({
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
