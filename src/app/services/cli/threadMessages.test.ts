import { describe, expect, it } from "vitest";

import { messagesFromTurns } from "@/app/services/cli/threadMessages";

describe("messagesFromTurns", () => {
  it("maps user/assistant/system messages from turn items", () => {
    const turns = [
      {
        id: "turn-1",
        items: [
          {
            type: "userMessage",
            content: [{ type: "text", text: "Review this patch" }],
          },
          {
            type: "agentMessage",
            text: "Patch reviewed.",
          },
          {
            type: "commandExecution",
            command: ["pnpm", "lint"],
            status: "completed",
          },
          {
            type: "fileChange",
            changes: [
              {
                path: "src/app.ts",
                diff: "+added\n-removed",
              },
            ],
          },
          {
            type: "webSearch",
            query: "latest tauri docs",
          },
        ],
      },
    ];

    expect(messagesFromTurns(turns)).toEqual([
      {
        id: "turn-1-user-0",
        role: "user",
        content: "Review this patch",
      },
      {
        id: "turn-1-assistant-1",
        role: "assistant",
        content: "Patch reviewed.",
      },
      {
        id: "turn-1-system-2",
        role: "system",
        content: "Command: pnpm lint (completed)",
      },
      {
        id: "turn-1-system-3",
        role: "system",
        content: "Edited 1 file (+1 -1)",
      },
      {
        id: "turn-1-system-4",
        role: "system",
        content: "Web search: latest tauri docs",
      },
    ]);
  });
});
