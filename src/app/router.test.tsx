import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/components/layout/AppShell", () => ({
  AppShell: () => null,
}));

import { router } from "@/app/router";

describe("router parity routes", () => {
  it("registers desktop parity route paths", () => {
    const routePaths = [
      router.buildLocation({ to: "/inbox" }).pathname,
      router.buildLocation({ to: "/login" }).pathname,
      router.buildLocation({ to: "/welcome" }).pathname,
      router.buildLocation({ to: "/select-workspace" }).pathname,
      router.buildLocation({
        to: "/local/$conversationId",
        params: { conversationId: "thread-1" },
      }).pathname,
      router.buildLocation({
        to: "/remote/$conversationId",
        params: { conversationId: "remote-1" },
      }).pathname,
      router.buildLocation({
        to: "/thread-overlay/$conversationId",
        params: { conversationId: "thread-1" },
      }).pathname,
    ];

    expect(routePaths).toMatchInlineSnapshot(`
      [
        "/inbox",
        "/login",
        "/welcome",
        "/select-workspace",
        "/local/thread-1",
        "/remote/remote-1",
        "/thread-overlay/thread-1",
      ]
    `);
  });
});
