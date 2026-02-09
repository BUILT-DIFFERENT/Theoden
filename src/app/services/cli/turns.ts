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
  | { type: "image"; url: string }
  | { type: "localImage"; path: string }
  | { type: "skill"; name: string; path: string }
  | { type: "mention"; name: string; path: string };

interface TurnCancelResponse {
  turn?: { id?: string; status?: string };
  [key: string]: unknown;
}

interface StartThreadParams {
  cwd?: string | null;
  model?: string | null;
  approvalPolicy?: string | null;
  sandbox?: string | null;
  personality?: "none" | "friendly" | "pragmatic" | null;
  dynamicTools?: unknown[] | null;
}

interface ResumeThreadParams {
  threadId: string;
  cwd?: string | null;
  model?: string | null;
  approvalPolicy?: string | null;
  sandbox?: string | null;
  personality?: "none" | "friendly" | "pragmatic" | null;
  dynamicTools?: unknown[] | null;
}

export async function startThread(params: StartThreadParams = {}) {
  const result = await requestAppServer<ThreadStartResponse>({
    method: "thread/start",
    params: {
      cwd: params.cwd ?? null,
      model: params.model ?? null,
      approvalPolicy: params.approvalPolicy ?? null,
      sandbox: params.sandbox ?? null,
      personality: params.personality ?? null,
      dynamicTools: params.dynamicTools ?? null,
      experimentalRawEvents: false,
    },
  });
  return result?.thread;
}

export async function resumeThread(params: ResumeThreadParams) {
  const result = await requestAppServer<ThreadStartResponse>({
    method: "thread/resume",
    params: {
      threadId: params.threadId,
      cwd: params.cwd ?? null,
      model: params.model ?? null,
      approvalPolicy: params.approvalPolicy ?? null,
      sandbox: params.sandbox ?? null,
      personality: params.personality ?? null,
      dynamicTools: params.dynamicTools ?? null,
    },
  });
  return result?.thread;
}

export async function startTurn(params: {
  threadId: string;
  input: string;
  cwd?: string | null;
  approvalPolicy?: string | null;
  sandboxPolicy?: unknown;
  model?: string | null;
  effort?: "low" | "medium" | "high" | "extra_high" | "xhigh" | null;
  summary?: "none" | "auto" | "concise" | "detailed" | null;
  personality?: "none" | "friendly" | "pragmatic" | null;
  outputSchema?: unknown;
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
      approvalPolicy: params.approvalPolicy ?? null,
      sandboxPolicy: params.sandboxPolicy ?? null,
      model: params.model ?? null,
      effort: params.effort ?? null,
      summary: params.summary ?? null,
      personality: params.personality ?? null,
      outputSchema: params.outputSchema ?? null,
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
