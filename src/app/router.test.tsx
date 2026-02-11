import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/components/layout/AppShell", () => ({
  AppShell: () => null,
}));

import { router } from "@/app/router";

describe("router parity routes", () => {
  it("registers desktop parity route paths", () => {
    const routePaths = [
      router.buildLocation({ to: "/diff" }).pathname,
      router.buildLocation({ to: "/file-preview" }).pathname,
      router.buildLocation({ to: "/plan-summary" }).pathname,
      router.buildLocation({ to: "/transcribe" }).pathname,
      router.buildLocation({ to: "/inbox" }).pathname,
      router.buildLocation({ to: "/login" }).pathname,
      router.buildLocation({ to: "/welcome" }).pathname,
      router.buildLocation({ to: "/select-workspace" }).pathname,
      router.buildLocation({ to: "/announcement" }).pathname,
      router.buildLocation({ to: "/first-run" }).pathname,
      router.buildLocation({ to: "/files" }).pathname,
      router.buildLocation({ to: "/debug" }).pathname,
      router.buildLocation({ to: "/prompts" }).pathname,
      router.buildLocation({ to: "/prompts:" }).pathname,
      router.buildLocation({
        to: "/local/$conversationId",
        params: { conversationId: "thread-1" },
      }).pathname,
      router.buildLocation({
        to: "/remote/$taskId",
        params: { taskId: "remote-1" },
      }).pathname,
      router.buildLocation({
        to: "/thread-overlay/$conversationId",
        params: { conversationId: "thread-1" },
      }).pathname,
      router.buildLocation({
        to: "/worktree-init-v2/$pendingId",
        params: { pendingId: "pending-1" },
      }).pathname,
      router.buildLocation({
        to: "/worktree-init-v2/$pendingWorktreeId",
        params: { pendingWorktreeId: "pending-2" },
      }).pathname,
      router.buildLocation({ to: "/settings/agent" }).pathname,
      router.buildLocation({ to: "/settings/data-controls" }).pathname,
      router.buildLocation({ to: "/settings/git-settings" }).pathname,
      router.buildLocation({ to: "/settings/local-environments" }).pathname,
      router.buildLocation({ to: "/settings/personalization" }).pathname,
      router.buildLocation({ to: "/settings/worktrees" }).pathname,
      router.buildLocation({ to: "/settings/mcp-settings" }).pathname,
      router.buildLocation({ to: "/settings/skills-settings" }).pathname,
      router.buildLocation({ to: "/wham/accounts/check" }).pathname,
      router.buildLocation({ to: "/wham/environments" }).pathname,
      router.buildLocation({ to: "/wham/tasks" }).pathname,
      router.buildLocation({ to: "/wham/tasks/list" }).pathname,
      router.buildLocation({ to: "/wham/usage" }).pathname,
      router.buildLocation({ to: "/wham/worktree_snapshots/finish_upload" })
        .pathname,
      router.buildLocation({ to: "/wham/worktree_snapshots/upload_url" })
        .pathname,
    ];

    expect(routePaths).toMatchInlineSnapshot(`
      [
        "/diff",
        "/file-preview",
        "/plan-summary",
        "/transcribe",
        "/inbox",
        "/login",
        "/welcome",
        "/select-workspace",
        "/announcement",
        "/first-run",
        "/files",
        "/debug",
        "/prompts",
        "/prompts:",
        "/local/thread-1",
        "/remote/remote-1",
        "/thread-overlay/thread-1",
        "/worktree-init-v2/pending-1",
        "/worktree-init-v2/pending-2",
        "/settings/agent",
        "/settings/data-controls",
        "/settings/git-settings",
        "/settings/local-environments",
        "/settings/personalization",
        "/settings/worktrees",
        "/settings/mcp-settings",
        "/settings/skills-settings",
        "/wham/accounts/check",
        "/wham/environments",
        "/wham/tasks",
        "/wham/tasks/list",
        "/wham/usage",
        "/wham/worktree_snapshots/finish_upload",
        "/wham/worktree_snapshots/upload_url",
      ]
    `);
  });
});
