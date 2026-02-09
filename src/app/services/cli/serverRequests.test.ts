import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleAppServerRequest } from "@/app/services/cli/serverRequests";

const { respondMock, approvalMock, cachedTokensMock } = vi.hoisted(() => ({
  respondMock: vi.fn(),
  approvalMock: vi.fn(),
  cachedTokensMock: vi.fn(),
}));

vi.mock("@/app/services/cli/appServer", () => ({
  respondAppServerRequest: respondMock,
}));

vi.mock("@/app/services/cli/approvals", () => ({
  registerApprovalRequest: approvalMock,
}));

vi.mock("@/app/services/cli/account", () => ({
  getCachedExternalChatgptTokens: cachedTokensMock,
}));

describe("handleAppServerRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    approvalMock.mockReturnValue(false);
    cachedTokensMock.mockReturnValue(null);
  });

  it("delegates approval requests without auto-responding", async () => {
    approvalMock.mockReturnValue(true);

    await handleAppServerRequest({
      id: 1,
      method: "item/commandExecution/requestApproval",
      params: {},
    });

    expect(approvalMock).toHaveBeenCalledTimes(1);
    expect(respondMock).not.toHaveBeenCalled();
  });

  it("responds to tool user-input requests with collected answers", async () => {
    const promptMock = vi
      .spyOn(window, "prompt")
      .mockReturnValueOnce("1")
      .mockReturnValueOnce("custom answer");

    await handleAppServerRequest({
      id: "req-2",
      method: "item/tool/requestUserInput",
      params: {
        itemId: "item-1",
        threadId: "thread-1",
        turnId: "turn-1",
        questions: [
          {
            id: "decision",
            header: "Decision",
            question: "Choose one",
            options: [
              { label: "Accept", description: "Proceed" },
              { label: "Decline", description: "Stop" },
            ],
          },
          {
            id: "notes",
            header: "Notes",
            question: "Provide details",
            isOther: true,
            options: null,
          },
        ],
      },
    });

    expect(promptMock).toHaveBeenCalledTimes(2);
    expect(respondMock).toHaveBeenCalledWith("req-2", {
      answers: {
        decision: { answers: ["Accept"] },
        notes: { answers: ["custom answer"] },
      },
    });
  });

  it("returns cached external tokens for refresh requests", async () => {
    cachedTokensMock.mockReturnValue({
      idToken: "id-token",
      accessToken: "access-token",
    });

    await handleAppServerRequest({
      id: 3,
      method: "account/chatgptAuthTokens/refresh",
      params: {
        reason: "unauthorized",
      },
    });

    expect(respondMock).toHaveBeenCalledWith(3, {
      idToken: "id-token",
      accessToken: "access-token",
    });
  });

  it("responds with method-not-found for unsupported server requests", async () => {
    await handleAppServerRequest({
      id: 4,
      method: "item/tool/call",
      params: {},
    });

    expect(respondMock).toHaveBeenCalledWith(
      4,
      undefined,
      expect.objectContaining({
        code: -32601,
      }),
    );
  });
});
