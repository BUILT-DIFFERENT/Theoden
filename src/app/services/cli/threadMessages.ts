import {
  getArray,
  getNumber,
  getObject,
  getString,
  getStringArray,
  isRecord,
} from "@/app/services/cli/appServerPayload";
import { diffStatsFromChanges } from "@/app/services/cli/diffSummary";
import type {
  ThreadMessage,
  ThreadMessageActivity,
  ThreadMessageActivityStatus,
} from "@/app/types";

function textFromContent(content: unknown[]): string | undefined {
  const textChunks: string[] = [];
  content.forEach((entry) => {
    if (typeof entry === "string") {
      textChunks.push(entry);
      return;
    }
    if (!isRecord(entry)) return;
    const text = getString(entry, "text");
    if (text) {
      textChunks.push(text);
      return;
    }
    const body = getObject(entry, "content");
    const bodyText = body ? getString(body, "text") : undefined;
    if (bodyText) {
      textChunks.push(bodyText);
    }
  });
  return textChunks.length ? textChunks.join("\n\n").trim() : undefined;
}

function messageTextFromItem(item: Record<string, unknown>) {
  const text = getString(item, "text");
  if (text) return text.trim();
  const output = getString(item, "output");
  if (output) return output.trim();
  const commandString = getStringArray(item, "command")?.join(" ");
  if (commandString) return commandString.trim();
  const command = getString(item, "command");
  if (command) return command.trim();
  const content = getArray(item, "content");
  if (content) return textFromContent(content);
  return undefined;
}

function activityStatusFromItem(status: string | undefined) {
  if (!status) return undefined;
  const normalized = status.toLowerCase();
  if (normalized === "inprogress" || normalized === "running") {
    return "running" satisfies ThreadMessageActivityStatus;
  }
  if (
    normalized === "completed" ||
    normalized === "succeeded" ||
    normalized === "success" ||
    normalized === "done"
  ) {
    return "completed" satisfies ThreadMessageActivityStatus;
  }
  if (normalized === "failed" || normalized === "error") {
    return "failed" satisfies ThreadMessageActivityStatus;
  }
  if (normalized === "declined") {
    return "declined" satisfies ThreadMessageActivityStatus;
  }
  return undefined;
}

function activityDurationFromItem(item: Record<string, unknown>) {
  const durationMs = getNumber(item, "durationMs");
  if (typeof durationMs !== "number") return undefined;
  if (durationMs < 0 || Number.isNaN(durationMs)) return undefined;
  return durationMs;
}

function activityFromItem(
  turnId: string,
  index: number,
  type: string,
  item: Record<string, unknown>,
): ThreadMessageActivity | null {
  if (type === "commandExecution") {
    const command = messageTextFromItem(item) ?? "command";
    const cwd = getString(item, "cwd");
    const status = activityStatusFromItem(getString(item, "status"));
    return {
      id: `${turnId}-activity-${index}`,
      kind: "command",
      label: command,
      detail: cwd ? `cwd: ${cwd}` : undefined,
      status,
      durationMs: activityDurationFromItem(item),
    };
  }
  if (type === "fileChange") {
    const changes = getArray(item, "changes") ?? [];
    const stats = diffStatsFromChanges(changes);
    const paths = changes.reduce<string[]>((acc, change) => {
      if (!isRecord(change)) return acc;
      const path = getString(change, "path");
      if (!path) return acc;
      acc.push(path);
      return acc;
    }, []);
    const status = activityStatusFromItem(getString(item, "status"));
    const detail = paths.length
      ? paths.slice(0, 3).join(", ") + (paths.length > 3 ? "..." : "")
      : undefined;
    return {
      id: `${turnId}-activity-${index}`,
      kind: "file_change",
      label: `applied edits to ${changes.length} file${
        changes.length === 1 ? "" : "s"
      } (+${stats.additions} -${stats.deletions})`,
      detail,
      status,
    };
  }
  if (type === "webSearch") {
    const query = getString(item, "query") ?? "web search";
    return {
      id: `${turnId}-activity-${index}`,
      kind: "web_search",
      label: `web search "${query}"`,
    };
  }
  if (type === "mcpToolCall") {
    const server = getString(item, "server");
    const tool = getString(item, "tool") ?? "tool";
    const status = activityStatusFromItem(getString(item, "status"));
    return {
      id: `${turnId}-activity-${index}`,
      kind: "tool",
      label: server ? `${server}.${tool}` : tool,
      status,
      durationMs: activityDurationFromItem(item),
    };
  }
  if (type === "collabAgentToolCall") {
    const tool = getString(item, "tool") ?? "agent tool";
    const status = activityStatusFromItem(getString(item, "status"));
    return {
      id: `${turnId}-activity-${index}`,
      kind: "tool",
      label: tool,
      status,
    };
  }
  return null;
}

function systemMessageFromItem(
  turnId: string,
  index: number,
  type: string,
): ThreadMessage | null {
  if (type === "reasoning") {
    return {
      id: `${turnId}-system-${index}`,
      role: "system",
      content: "Reasoning step",
    };
  }
  if (type === "enteredReviewMode") {
    return {
      id: `${turnId}-system-${index}`,
      role: "system",
      content: "Entered review mode",
    };
  }
  if (type === "exitedReviewMode") {
    return {
      id: `${turnId}-system-${index}`,
      role: "system",
      content: "Exited review mode",
    };
  }
  if (type === "contextCompaction") {
    return {
      id: `${turnId}-system-${index}`,
      role: "system",
      content: "Context compacted",
    };
  }
  return null;
}

export function messagesFromTurns(turns: unknown[]): ThreadMessage[] {
  const messages: ThreadMessage[] = [];

  turns.forEach((turn, turnIndex) => {
    if (!isRecord(turn)) return;
    const turnId = getString(turn, "id") ?? `turn-${turnIndex + 1}`;
    const items = getArray(turn, "items") ?? [];
    const assistantIndexes: number[] = [];
    const activities: ThreadMessageActivity[] = [];
    let workedDurationMs = 0;
    let hasWorkedDuration = false;

    items.forEach((item, itemIndex) => {
      if (!isRecord(item)) return;
      const itemType = getString(item, "type");
      if (!itemType) return;
      const text = messageTextFromItem(item);

      if (itemType === "userMessage") {
        if (!text) return;
        messages.push({
          id: `${turnId}-user-${itemIndex}`,
          role: "user",
          content: text,
        });
        return;
      }

      if (itemType === "agentMessage" || itemType === "plan") {
        if (!text) return;
        messages.push({
          id: `${turnId}-assistant-${itemIndex}`,
          role: "assistant",
          content: text,
        });
        assistantIndexes.push(messages.length - 1);
        return;
      }

      if (itemType === "reasoning") {
        const summary = getStringArray(item, "summary") ?? [];
        if (!summary.length) return;
        messages.push({
          id: `${turnId}-assistant-${itemIndex}`,
          role: "assistant",
          content: summary.join("\n"),
        });
        assistantIndexes.push(messages.length - 1);
        return;
      }

      const activity = activityFromItem(turnId, itemIndex, itemType, item);
      if (activity) {
        activities.push(activity);
        if (typeof activity.durationMs === "number") {
          workedDurationMs += activity.durationMs;
          hasWorkedDuration = true;
        }
        return;
      }

      const systemMessage = systemMessageFromItem(turnId, itemIndex, itemType);
      if (!systemMessage) return;
      messages.push(systemMessage);
    });

    if (!activities.length) return;
    const targetAssistantIndex = assistantIndexes.at(-1);
    if (typeof targetAssistantIndex !== "number") {
      messages.push({
        id: `${turnId}-system-activity`,
        role: "system",
        content: "Agent activity",
        activities,
        workedDurationMs: hasWorkedDuration ? workedDurationMs : undefined,
      });
      return;
    }
    const targetMessage = messages[targetAssistantIndex];
    targetMessage.activities = [
      ...(targetMessage.activities ?? []),
      ...activities,
    ];
    if (hasWorkedDuration) {
      targetMessage.workedDurationMs =
        (targetMessage.workedDurationMs ?? 0) + workedDurationMs;
    }
  });

  return messages;
}
