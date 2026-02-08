import { describe, expect, it } from "vitest";

import { messagesFromTurns } from "@/app/services/cli/threadMessages";

describe("messagesFromTurns", () => {
  it("attaches agent activity and duration to assistant messages", () => {
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
            durationMs: 1200,
            cwd: "/workspace/project",
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
        activities: [
          {
            id: "turn-1-activity-2",
            kind: "command",
            label: "pnpm lint",
            detail: "cwd: /workspace/project",
            status: "completed",
            durationMs: 1200,
          },
          {
            id: "turn-1-activity-3",
            kind: "file_change",
            label: "applied edits to 1 file (+1 -1)",
            detail: "src/app.ts",
            status: undefined,
          },
          {
            id: "turn-1-activity-4",
            kind: "web_search",
            label: 'web search "latest tauri docs"',
          },
        ],
        workedDurationMs: 1200,
      },
    ]);
  });

  it("falls back to a system activity entry when no assistant message exists", () => {
    const turns = [
      {
        id: "turn-2",
        items: [
          {
            type: "commandExecution",
            command: "pnpm frontend:test",
            status: "failed",
            durationMs: 5000,
          },
        ],
      },
    ];

    expect(messagesFromTurns(turns)).toEqual([
      {
        id: "turn-2-system-activity",
        role: "system",
        content: "Agent activity",
        activities: [
          {
            id: "turn-2-activity-0",
            kind: "command",
            label: "pnpm frontend:test",
            detail: undefined,
            status: "failed",
            durationMs: 5000,
          },
        ],
        workedDurationMs: 5000,
      },
    ]);
  });
});
