import { sendAppServerRequest } from "@/app/services/cli/appServer";

let requestNonce = 0;

export function nextAppServerRequestId() {
  requestNonce += 1;
  return Date.now() * 1000 + requestNonce;
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
