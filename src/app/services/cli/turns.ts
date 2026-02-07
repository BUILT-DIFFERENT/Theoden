import { requestAppServer } from "@/app/services/cli/rpc";
import type { AppServerThread } from "@/app/services/cli/threads";

export interface ThreadStartResponse {
  thread: AppServerThread;
}

export interface TurnStartResponse {
  turn: { id: string; status: string };
}

export type TurnInputItem =
  | { type: "text"; text: string }
  | { type: "skill"; name: string; path: string }
  | { type: "mention"; name: string; path: string };

interface TurnCancelResponse {
  turn?: { id?: string; status?: string };
  [key: string]: unknown;
}

export async function startThread(params: {
  cwd?: string | null;
  model?: string | null;
}) {
  const result = await requestAppServer<ThreadStartResponse>({
    method: "thread/start",
    params: {
      cwd: params.cwd ?? null,
      model: params.model ?? null,
      experimentalRawEvents: false,
    },
  });
  return result?.thread;
}

export async function resumeThread(params: { threadId: string }) {
  const result = await requestAppServer<ThreadStartResponse>({
    method: "thread/resume",
    params: {
      threadId: params.threadId,
    },
  });
  return result?.thread;
}

export async function startTurn(params: {
  threadId: string;
  input: string;
  cwd?: string | null;
  effort?: "medium" | "high" | "xhigh" | null;
  inputItems?: TurnInputItem[] | null;
}) {
  const inputItems =
    params.inputItems && params.inputItems.length
      ? params.inputItems
      : [{ type: "text", text: params.input }];
  const result = await requestAppServer<TurnStartResponse>({
    method: "turn/start",
    params: {
      threadId: params.threadId,
      input: inputItems,
      cwd: params.cwd ?? null,
      effort: params.effort ?? null,
    },
  });
  return result?.turn;
}

export async function cancelTurn(params: {
  threadId: string;
  turnId?: string | null;
}) {
  if (!params.turnId) {
    throw new Error("Cannot interrupt turn without a turnId.");
  }
  return requestAppServer<TurnCancelResponse>({
    method: "turn/interrupt",
    params: {
      threadId: params.threadId,
      turnId: params.turnId,
    },
  });
}
