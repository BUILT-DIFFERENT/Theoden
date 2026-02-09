import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  cancelAccountLogin,
  logoutAccount,
  startAccountLogin,
} from "@/app/services/cli/account";
import { requestAppServer } from "@/app/services/cli/rpc";

vi.mock("@/app/services/cli/rpc", () => ({
  requestAppServer: vi.fn(),
}));

describe("account service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes chatgpt login start responses", async () => {
    const requestMock = vi.mocked(requestAppServer);
    requestMock.mockResolvedValueOnce({
      type: "chatgpt",
      login_id: "login-123",
      auth_url: "https://example.test/login",
    });

    await expect(startAccountLogin("chatgpt")).resolves.toEqual({
      type: "chatgpt",
      loginId: "login-123",
      authUrl: "https://example.test/login",
    });
  });

  it("handles api key login and logout", async () => {
    const requestMock = vi.mocked(requestAppServer);
    requestMock.mockResolvedValueOnce({
      type: "apiKey",
    });
    requestMock.mockResolvedValueOnce({
      ok: true,
    });

    await expect(startAccountLogin("apiKey", "sk-test")).resolves.toEqual({
      type: "apiKey",
    });
    await expect(logoutAccount()).resolves.toEqual({
      ok: true,
    });
  });

  it("cancels a pending account login", async () => {
    const requestMock = vi.mocked(requestAppServer);
    requestMock.mockResolvedValueOnce({
      status: "canceled",
    });

    await expect(cancelAccountLogin("login-123")).resolves.toBe("canceled");
    expect(requestMock).toHaveBeenCalledWith({
      method: "account/login/cancel",
      params: {
        loginId: "login-123",
      },
    });
  });

  it("throws when chatgpt login metadata is missing", async () => {
    const requestMock = vi.mocked(requestAppServer);
    requestMock.mockResolvedValueOnce({
      type: "chatgpt",
    });

    await expect(startAccountLogin("chatgpt")).rejects.toThrow(
      "ChatGPT login start did not return login metadata.",
    );
  });
});
