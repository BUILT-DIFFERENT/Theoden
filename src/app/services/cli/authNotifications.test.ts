import { describe, expect, it, vi } from "vitest";

import {
  registerAuthNotification,
  subscribeAccountLoginCompleted,
  subscribeMcpOauthLoginCompleted,
} from "@/app/services/cli/authNotifications";

describe("auth notification parsing", () => {
  it("parses account/login/completed and notifies listeners", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAccountLoginCompleted(listener);

    const events = registerAuthNotification({
      method: "account/login/completed",
      params: {
        loginId: "login-123",
        success: true,
      },
    });

    expect(events.accountLoginCompleted).toEqual({
      loginId: "login-123",
      success: true,
      error: null,
    });
    expect(listener).toHaveBeenCalledWith({
      loginId: "login-123",
      success: true,
      error: null,
    });

    unsubscribe();
  });

  it("ignores legacy loginChatGptComplete notifications", () => {
    const events = registerAuthNotification({
      method: "loginChatGptComplete",
      params: {
        loginId: "legacy-login",
        success: false,
        error: "denied",
      },
    });

    expect(events.accountLoginCompleted).toBeUndefined();
  });

  it("parses mcpServer/oauthLogin/completed and notifies listeners", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMcpOauthLoginCompleted(listener);

    const events = registerAuthNotification({
      method: "mcpServer/oauthLogin/completed",
      params: {
        name: "github",
        success: true,
      },
    });

    expect(events.mcpOauthLoginCompleted).toEqual({
      name: "github",
      success: true,
      error: null,
    });
    expect(listener).toHaveBeenCalledWith({
      name: "github",
      success: true,
      error: null,
    });

    unsubscribe();
  });
});
