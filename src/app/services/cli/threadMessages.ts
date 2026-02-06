import {
  getArray,
  getObject,
  getString,
  getStringArray,
  isRecord,
} from "@/app/services/cli/appServerPayload";
import { diffStatsFromChanges } from "@/app/services/cli/diffSummary";
import type { ThreadMessage } from "@/app/types";

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

function systemMessageFromItem(
  turnId: string,
  index: number,
  type: string,
  item: Record<string, unknown>,
): ThreadMessage | null {
  if (type === "fileChange") {
    const changes = getArray(item, "changes") ?? [];
    const stats = diffStatsFromChanges(changes);
    return {
      id: `${turnId}-system-${index}`,
      role: "system",
      content: `Edited ${changes.length} file${changes.length === 1 ? "" : "s"} (+${stats.additions} -${stats.deletions})`,
    };
  }
  if (type === "commandExecution") {
    const command = messageTextFromItem(item) ?? "command";
    const status = getString(item, "status");
    return {
      id: `${turnId}-system-${index}`,
      role: "system",
      content: `Command: ${command}${status ? ` (${status})` : ""}`,
    };
  }
  if (type === "webSearch") {
    const query = getString(item, "query") ?? "web search";
    return {
      id: `${turnId}-system-${index}`,
      role: "system",
      content: `Web search: ${query}`,
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
        return;
      }

      const systemMessage = systemMessageFromItem(
        turnId,
        itemIndex,
        itemType,
        item,
      );
      if (!systemMessage) return;
      messages.push(systemMessage);
    });
  });

  return messages;
}
