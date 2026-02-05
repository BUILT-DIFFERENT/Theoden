import {
  getArray,
  getString,
  getStringArray,
  isRecord,
} from "@/app/services/cli/appServerPayload";
import { diffStatsFromChanges } from "@/app/services/cli/diffSummary";
import type { RunEvent, RunStatus } from "@/app/types";

const HISTORY_TIMESTAMP = "History";

export function buildTimelineFromTurns(turns: unknown[]): RunEvent[] {
  const events: RunEvent[] = [];
  turns.forEach((turn, turnIndex) => {
    if (!isRecord(turn)) return;
    const turnId = getString(turn, "id") ?? `turn-${turnIndex + 1}`;
    const items = getArray(turn, "items") ?? [];
    items.forEach((item, itemIndex) => {
      if (!isRecord(item)) return;
      const itemId = getString(item, "id") ?? `item-${itemIndex + 1}`;
      const label = labelFromItem(item);
      const detail = detailFromItem(item);
      events.push({
        id: `history-${turnId}-${itemId}`,
        timestamp: HISTORY_TIMESTAMP,
        label,
        detail,
        status: statusFromItem(item),
      });
    });
  });
  return events;
}

function statusFromItem(item: Record<string, unknown>): RunStatus {
  const type = getString(item, "type");
  if (type === "commandExecution") {
    const status = getString(item, "status");
    return statusFromLifecycle(status);
  }
  if (type === "fileChange") {
    const status = getString(item, "status");
    return statusFromLifecycle(status);
  }
  if (type === "mcpToolCall" || type === "collabAgentToolCall") {
    const status = getString(item, "status");
    return statusFromLifecycle(status);
  }
  return "done";
}

function statusFromLifecycle(status?: string | null): RunStatus {
  if (status === "failed") return "failed";
  if (status === "declined") return "needs_review";
  if (status === "inProgress") return "running";
  if (status === "completed") return "done";
  return "done";
}

function labelFromItem(item: Record<string, unknown>) {
  const type = getString(item, "type");
  if (type === "userMessage") return "User message";
  if (type === "agentMessage") return "Agent response";
  if (type === "plan") return "Plan updated";
  if (type === "reasoning") return "Reasoning";
  if (type === "enteredReviewMode") return "Review started";
  if (type === "exitedReviewMode") return "Review complete";
  if (type === "contextCompaction") return "Context compacted";
  if (type === "webSearch") {
    const query = getString(item, "query");
    return `Search: ${query ?? "web"}`;
  }
  if (type === "mcpToolCall") {
    const tool = getString(item, "tool");
    return `Tool: ${tool ?? "mcp"}`;
  }
  if (type === "collabAgentToolCall") {
    const tool = getString(item, "tool");
    return `Collab: ${tool ?? "agent"}`;
  }
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
  return type ?? "Item";
}

function detailFromItem(item: Record<string, unknown>) {
  const type = getString(item, "type");
  if (type === "commandExecution") {
    return commandStringFromRecord(item);
  }
  if (type === "fileChange") {
    const changes = getArray(item, "changes") ?? [];
    const paths = changes.reduce<string[]>((acc, change) => {
      if (!isRecord(change)) return acc;
      const path = getString(change, "path");
      if (path) acc.push(path);
      return acc;
    }, []);
    if (!paths.length) return undefined;
    return paths.slice(0, 3).join(", ") + (paths.length > 3 ? "…" : "");
  }
  if (type === "webSearch") {
    return getString(item, "query");
  }
  if (type === "plan") {
    const text = getString(item, "text");
    return text ? truncate(text, 120) : undefined;
  }
  if (type === "agentMessage") {
    const text = getString(item, "text");
    return text ? truncate(text, 120) : undefined;
  }
  if (type === "mcpToolCall") {
    const tool = getString(item, "tool");
    const server = getString(item, "server");
    if (tool && server) return `${server} · ${tool}`;
    return tool ?? server;
  }
  if (type === "collabAgentToolCall") {
    const tool = getString(item, "tool");
    return tool ?? undefined;
  }
  return undefined;
}

function commandStringFromRecord(record: Record<string, unknown>) {
  const command = getString(record, "command");
  if (command) return command;
  return getStringArray(record, "command")?.join(" ");
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return value.slice(0, max - 1).trimEnd() + "…";
}
