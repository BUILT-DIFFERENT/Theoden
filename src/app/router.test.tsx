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
      router.buildLocation({ to: "/settings/agent" }).pathname,
      router.buildLocation({ to: "/settings/data-controls" }).pathname,
      router.buildLocation({ to: "/settings/git-settings" }).pathname,
      router.buildLocation({ to: "/settings/local-environments" }).pathname,
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
        "/local/thread-1",
        "/remote/remote-1",
        "/thread-overlay/thread-1",
        "/worktree-init-v2/pending-1",
        "/settings/agent",
        "/settings/data-controls",
        "/settings/git-settings",
        "/settings/local-environments",
      ]
    `);
  });
});
