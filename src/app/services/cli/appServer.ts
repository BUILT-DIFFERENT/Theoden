import { invoke } from "@tauri-apps/api/tauri";

export interface AppServerStartRequest {
  args?: string[];
  cwd?: string;
}

export interface AppServerRequest {
  id: number;
  method: string;
  params?: unknown;
}

export interface AppServerResponse<T = unknown> {
  id: number;
  result?: T;
  error?: { message: string };
}

export async function startAppServer(request: AppServerStartRequest) {
  return invoke("app_server_start", request);
}

export async function stopAppServer() {
  return invoke("app_server_stop");
}

export async function sendAppServerRequest<T>(request: AppServerRequest): Promise<AppServerResponse<T>> {
  return invoke("app_server_request", request);
}

export async function sendAppServerNotification(method: string, params?: unknown) {
  return invoke("app_server_notify", { method, params });
}
