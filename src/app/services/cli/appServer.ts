import { invoke } from "@tauri-apps/api/core";

export interface AppServerClientInfo {
  name: string;
  title: string;
  version: string;
}

export interface AppServerStartRequest extends Record<string, unknown> {
  args?: string[];
  cwd?: string;
  clientInfo?: AppServerClientInfo;
}

export interface AppServerRequest extends Record<string, unknown> {
  id: string | number;
  method: string;
  params?: unknown;
}

export interface AppServerResponse<T = unknown> {
  id: string | number;
  result?: T;
  error?: {
    code?: number;
    message: string;
    data?: unknown;
  };
}

export async function startAppServer(request: AppServerStartRequest) {
  return invoke("app_server_start", request);
}

export async function stopAppServer() {
  return invoke("app_server_stop");
}

export async function sendAppServerRequest<T>(
  request: AppServerRequest,
): Promise<AppServerResponse<T>> {
  return invoke("app_server_request", request);
}

export async function sendAppServerNotification(
  method: string,
  params?: unknown,
) {
  return invoke("app_server_notify", { method, params });
}

export async function respondAppServerRequest(
  id: string | number,
  result?: unknown,
  error?: unknown,
) {
  return invoke("app_server_respond", { id, result, error });
}
