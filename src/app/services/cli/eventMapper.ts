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

function itemLabel(item: Record<string, any>) {
  const type = item.type;
  if (type === "commandExecution") {
    const command = item.command?.join(" ") ?? "Command";
    return `Command: ${command}`;
  }
  if (type === "fileChange") {
    const count = item.changes?.length ?? 0;
    return `Edited ${count} file${count === 1 ? "" : "s"}`;
  }
  if (type === "plan") {
    return "Plan updated";
  }
  if (type === "reasoning") {
    return "Reasoning";
  }
  if (type === "webSearch") {
    return `Search: ${item.query ?? "web"}`;
  }
  if (type === "mcpToolCall") {
    return `Tool: ${item.tool ?? "mcp"}`;
  }
  return type ?? "Item";
}

function labelFromMethod(method: string, params?: Record<string, any>) {
  if (method === "thread/started") return "Thread started";
  if (method === "turn/started") return "Turn started";
  if (method === "turn/completed") return "Turn completed";
  if (method === "turn/diff/updated") return "Diff updated";
  if (method === "turn/plan/updated") return "Plan updated";
  if (method === "item/started" && params?.item) return itemLabel(params.item);
  if (method === "item/completed" && params?.item) return `${itemLabel(params.item)} (done)`;
  if (method === "item/commandExecution/outputDelta") return "Command output";
  if (method === "item/fileChange/outputDelta") return "File change output";
  if (method === "item/fileChange/requestApproval") return "Approve file change";
  if (method === "item/commandExecution/requestApproval") return "Approve command";
  if (method === "item/agentMessage/delta") return "Agent message";
  return method;
}

function detailFromParams(method: string, params?: Record<string, any>) {
  if (!params) return undefined;
  if (method.startsWith("item/") && params.item) {
    if (params.item.type === "fileChange") {
      const paths = params.item.changes?.map((c: any) => c.path).filter(Boolean);
      if (paths?.length) {
        return paths.slice(0, 3).join(", ") + (paths.length > 3 ? "…" : "");
      }
    }
    if (params.item.type === "commandExecution") {
      return params.item.command?.join(" ");
    }
  }
  if (method === "turn/diff/updated" && params.diff) {
    return `Updated diff (${params.diff?.length ?? 0} chars)`;
  }
  if (params.turn?.status) {
    return `Turn ${params.turn.status}`;
  }
  return undefined;
}

export function mapNotificationToRunEvent(notification: AppServerNotification): RunEvent | null {
  if (!notification?.method) return null;
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return {
    id: `${notification.method}-${Date.now()}`,
    timestamp,
    label: labelFromMethod(notification.method, notification.params),
    detail: detailFromParams(notification.method, notification.params),
    status: statusFromMethod(notification.method, notification.params)
  };
}
