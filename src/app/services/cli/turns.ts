import { sendAppServerRequest } from "@/app/services/cli/appServer";
import type { AppServerThread } from "@/app/services/cli/threads";

export interface ThreadStartResponse {
  thread: AppServerThread;
}

export interface TurnStartResponse {
  turn: { id: string; status: string };
}

function requestId() {
  return Math.floor(Date.now() + Math.random() * 1000);
}

export async function startThread(params: {
  cwd?: string | null;
  model?: string | null;
}) {
  const response = await sendAppServerRequest<ThreadStartResponse>({
    id: requestId(),
    method: "thread/start",
    params: {
      cwd: params.cwd ?? null,
      model: params.model ?? null,
      experimentalRawEvents: false,
    },
  });
  if (response.error) {
    throw new Error(response.error.message);
  }
  return response.result?.thread;
}

export async function resumeThread(params: { threadId: string }) {
  const response = await sendAppServerRequest<ThreadStartResponse>({
    id: requestId(),
    method: "thread/resume",
    params: {
      threadId: params.threadId,
    },
  });
  if (response.error) {
    throw new Error(response.error.message);
  }
  return response.result?.thread;
}

export async function startTurn(params: {
  threadId: string;
  input: string;
  cwd?: string | null;
  effort?: "medium" | "high" | "xhigh" | null;
}) {
  const response = await sendAppServerRequest<TurnStartResponse>({
    id: requestId(),
    method: "turn/start",
    params: {
      threadId: params.threadId,
      input: [{ type: "text", text: params.input }],
      cwd: params.cwd ?? null,
      effort: params.effort ?? null,
    },
  });
  if (response.error) {
    throw new Error(response.error.message);
  }
  return response.result?.turn;
}
