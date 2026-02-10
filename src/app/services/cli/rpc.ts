import { sendAppServerRequest } from "@/app/services/cli/appServer";

let requestNonce = 1;

const documentedMethods = [
  "account/login/cancel",
  "account/login/start",
  "account/logout",
  "account/rateLimits/read",
  "account/read",
  "app/list",
  "collaborationMode/list",
  "command/exec",
  "config/batchWrite",
  "config/mcpServer/reload",
  "config/read",
  "config/value/write",
  "configRequirements/read",
  "feedback/upload",
  "initialize",
  "mcpServer/oauth/login",
  "mcpServerStatus/list",
  "model/list",
  "review/start",
  "skills/config/write",
  "skills/list",
  "thread/archive",
  "thread/fork",
  "thread/list",
  "thread/loaded/list",
  "thread/read",
  "thread/resume",
  "thread/rollback",
  "thread/start",
  "thread/unarchive",
  "turn/interrupt",
  "turn/start",
] as const;

const DOCUMENTED_METHOD_SET = new Set<string>(documentedMethods);

export class AppServerRpcError extends Error {
  code?: number;
  data?: unknown;

  constructor(message: string, options?: { code?: number; data?: unknown }) {
    super(message);
    this.name = "AppServerRpcError";
    this.code = options?.code;
    this.data = options?.data;
  }
}

export function nextAppServerRequestId() {
  requestNonce = requestNonce >= Number.MAX_SAFE_INTEGER ? 1 : requestNonce + 1;
  return requestNonce;
}

export function isDocumentedAppServerMethod(method: string) {
  return DOCUMENTED_METHOD_SET.has(method);
}

export function assertDocumentedAppServerMethod(method: string) {
  if (isDocumentedAppServerMethod(method)) {
    return;
  }
  throw new Error(
    `Undocumented app-server RPC method "${method}" is not allowed.`,
  );
}

export async function requestAppServer<TResult, TParams = unknown>(options: {
  method: string;
  params?: TParams;
}) {
  assertDocumentedAppServerMethod(options.method);
  const response = await sendAppServerRequest<TResult>({
    id: nextAppServerRequestId(),
    method: options.method,
    params: options.params,
  });
  if (response.error) {
    throw new AppServerRpcError(response.error.message, {
      code: response.error.code,
      data: response.error.data,
    });
  }
  return response.result;
}
