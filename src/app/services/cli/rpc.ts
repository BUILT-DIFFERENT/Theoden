import { sendAppServerRequest } from "@/app/services/cli/appServer";

let requestNonce = 1;

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

export async function requestAppServer<TResult, TParams = unknown>(options: {
  method: string;
  params?: TParams;
}) {
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
