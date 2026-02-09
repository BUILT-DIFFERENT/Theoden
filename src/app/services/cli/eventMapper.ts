import {
  getArray,
  getObject,
  getString,
  getStringArray,
  isRecord,
  type AppServerNotification,
  type JsonObject,
} from "@/app/services/cli/appServerPayload";
import {
  diffStatsFromChanges,
  diffStatsFromText,
} from "@/app/services/cli/diffSummary";
import type { RunEvent, RunStatus } from "@/app/types";

const METHOD_LABELS: Record<string, string> = {
  "thread/started": "Thread started",
  "turn/started": "Turn started",
  "turn/completed": "Turn completed",
  "turn/diff/updated": "Diff updated",
  "turn/plan/updated": "Plan updated",
  "item/commandExecution/outputDelta": "Command output",
  "item/fileChange/outputDelta": "File change output",
  "item/fileChange/requestApproval": "Approve file change",
  "item/commandExecution/requestApproval": "Approve command",
  "item/tool/requestUserInput": "Tool input requested",
  "tool/requestUserInput": "Tool input requested",
  "item/agentMessage/delta": "Agent message",
  "item/plan/delta": "Plan delta",
  "item/reasoning/summaryTextDelta": "Reasoning summary",
  "item/reasoning/summaryPartAdded": "Reasoning summary part",
  "item/reasoning/textDelta": "Reasoning text",
  "thread/tokenUsage/updated": "Token usage",
  "account/updated": "Account updated",
  "account/login/completed": "Login completed",
  "account/rateLimits/updated": "Rate limits updated",
  "mcpServer/oauthLogin/completed": "MCP OAuth completed",
};

function statusFromMethod(method: string, params?: JsonObject): RunStatus {
  if (method.includes("requestApproval")) return "needs_review";
  if (method.includes("error") || method.includes("failed")) return "failed";
  if (method.includes("completed")) {
    const turn = params ? getObject(params, "turn") : undefined;
    const turnStatus = turn ? getString(turn, "status") : undefined;
    if (turnStatus === "failed") return "failed";
    return "done";
  }
  return "running";
}

function itemLabel(item: JsonObject) {
  const type = getString(item, "type");
  if (type === "commandExecution") {
    const command = commandStringFromRecord(item) ?? "Command";
    return `Command: ${command}`;
  }
  if (type === "fileChange") {
    const changes = getArray(item, "changes") ?? [];
    const count = changes.length;
    const { additions, deletions } = diffStatsFromChanges(changes);
    const diffSuffix =
      additions || deletions ? ` +${additions} -${deletions}` : "";
    return `Edited ${count} file${count === 1 ? "" : "s"}${diffSuffix}`;
  }
  if (type === "plan") {
    return "Plan updated";
  }
  if (type === "reasoning") {
    return "Reasoning";
  }
  if (type === "webSearch") {
    const query = getString(item, "query");
    return `Search: ${query ?? "web"}`;
  }
  if (type === "mcpToolCall") {
    const tool = getString(item, "tool");
    return `Tool: ${tool ?? "mcp"}`;
  }
  if (type === "collabToolCall" || type === "collabAgentToolCall") {
    const tool = getString(item, "tool");
    return `Collab: ${tool ?? "tool"}`;
  }
  if (type === "contextCompaction") {
    return "Context compacted";
  }
  return type ?? "Item";
}

function labelFromMethod(method: string, params?: JsonObject) {
  const item = params ? getObject(params, "item") : undefined;
  if (method === "item/started" && item) return itemLabel(item);
  if (method === "item/completed" && item) return `${itemLabel(item)} (done)`;
  return METHOD_LABELS[method] ?? method;
}

function detailFromParams(method: string, params?: JsonObject) {
  if (!params) return undefined;
  const item = getObject(params, "item");
  if (method.startsWith("item/") && item) {
    const itemType = getString(item, "type");
    if (itemType === "fileChange") {
      const changes = getArray(item, "changes") ?? [];
      const paths = changes.reduce<string[]>((acc, change) => {
        if (!isRecord(change)) {
          return acc;
        }
        const path = getString(change, "path");
        if (path) {
          acc.push(path);
        }
        return acc;
      }, []);
      if (paths.length) {
        return paths.slice(0, 3).join(", ") + (paths.length > 3 ? "…" : "");
      }
    }
    if (itemType === "commandExecution") {
      return commandStringFromRecord(item);
    }
  }
  if (method === "turn/diff/updated") {
    const diff = getString(params, "diff");
    if (!diff) return undefined;
    const { additions, deletions } = diffStatsFromText(diff);
    if (additions || deletions) {
      return `Diff +${additions} -${deletions}`;
    }
    return `Updated diff (${diff.length} chars)`;
  }
  const turn = getObject(params, "turn");
  const status = turn ? getString(turn, "status") : undefined;
  if (status) {
    return `Turn ${status}`;
  }
  return undefined;
}

function commandStringFromRecord(record: JsonObject) {
  const command = getString(record, "command");
  if (command) return command;
  return getStringArray(record, "command")?.join(" ");
}

export function mapNotificationToRunEvent(
  notification: AppServerNotification,
): RunEvent | null {
  if (!notification?.method) return null;
  const timestamp = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return {
    id: `${notification.method}-${Date.now()}`,
    timestamp,
    label: labelFromMethod(notification.method, notification.params),
    detail: detailFromParams(notification.method, notification.params),
    status: statusFromMethod(notification.method, notification.params),
  };
}
