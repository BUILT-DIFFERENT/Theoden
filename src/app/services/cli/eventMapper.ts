import type { RunEvent, RunStatus } from "@/app/types";

export interface AppServerNotification {
  method: string;
  params?: Record<string, any>;
}

function statusFromMethod(method: string, params?: Record<string, any>): RunStatus {
  if (method.includes("requestApproval")) {
    return "needs_review";
  }
  if (method.includes("error") || method.includes("failed")) {
    return "failed";
  }
  if (method.includes("completed")) {
    const turnStatus = params?.turn?.status;
    if (turnStatus === "failed") {
      return "failed";
    }
    return "done";
  }
  return "running";
}

function detailFromParams(params?: Record<string, any>) {
  if (!params) return undefined;
  if (params.item?.type) {
    const status = params.item?.status ? ` (${params.item.status})` : "";
    return `${params.item.type}${status}`;
  }
  if (params.turn?.status) {
    return `Turn ${params.turn.status}`;
  }
  if (params.diff) {
    return "Diff updated";
  }
  return undefined;
}

export function mapNotificationToRunEvent(notification: AppServerNotification): RunEvent | null {
  if (!notification?.method) return null;
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return {
    id: `${notification.method}-${Date.now()}`,
    timestamp,
    label: notification.method,
    detail: detailFromParams(notification.params),
    status: statusFromMethod(notification.method, notification.params)
  };
}
