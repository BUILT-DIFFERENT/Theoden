import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  isDocumentedAppServerMethod,
  requestAppServer,
} from "@/app/services/cli/rpc";

const { sendAppServerRequestMock } = vi.hoisted(() => ({
  sendAppServerRequestMock: vi.fn(),
}));

vi.mock("@/app/services/cli/appServer", () => ({
  sendAppServerRequest: sendAppServerRequestMock,
}));

describe("requestAppServer documented method enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts known documented method names", () => {
    expect(isDocumentedAppServerMethod("thread/start")).toBe(true);
    expect(isDocumentedAppServerMethod("turn/start")).toBe(true);
    expect(isDocumentedAppServerMethod("model/list")).toBe(true);
    expect(isDocumentedAppServerMethod("skills/list")).toBe(true);
    expect(isDocumentedAppServerMethod("skills/config/write")).toBe(true);
  });

  it("rejects undocumented outbound methods before invoke", async () => {
    await expect(
      requestAppServer({
        method: "skills/remote/read",
        params: {},
      }),
    ).rejects.toThrow(
      'Undocumented app-server RPC method "skills/remote/read" is not allowed.',
    );

    expect(sendAppServerRequestMock).not.toHaveBeenCalled();
  });

  it("sends documented requests through the app-server invoke bridge", async () => {
    sendAppServerRequestMock.mockResolvedValue({
      id: 12,
      result: { ok: true },
    });

    await expect(
      requestAppServer<{ ok: boolean }>({
        method: "thread/read",
        params: { threadId: "thread-1", includeTurns: false },
      }),
    ).resolves.toEqual({ ok: true });

    expect(sendAppServerRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "thread/read",
        params: { threadId: "thread-1", includeTurns: false },
      }),
    );
  });
});
