import { sendAppServerRequest } from "@/app/services/cli/appServer";

let requestNonce = 1;

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
    throw new Error(response.error.message);
  }
  return response.result;
}
