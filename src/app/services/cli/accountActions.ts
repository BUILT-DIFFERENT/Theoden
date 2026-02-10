import {
  cancelAccountLogin,
  logoutAccount,
  startAccountLogin,
} from "@/app/services/cli/account";
import { isTauri } from "@/app/utils/tauri";

export type AccountAction = "login-chatgpt" | "login-api-key" | "logout";

export class AccountActionCancelledError extends Error {
  constructor(message = "Account action cancelled.") {
    super(message);
    this.name = "AccountActionCancelledError";
  }
}

export function readLoginUrl(result: unknown) {
  if (!result || typeof result !== "object") {
    return null;
  }
  const record = result as Record<string, unknown>;
  const knownKeys = [
    "authUrl",
    "verificationUri",
    "browserUrl",
    "url",
    "authorizeUrl",
  ];
  for (const key of knownKeys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length) {
      return value;
    }
  }
  return null;
}

export function readLoginId(result: unknown) {
  if (!result || typeof result !== "object") {
    return null;
  }
  const record = result as Record<string, unknown>;
  const knownKeys = ["loginId", "login_id"];
  for (const key of knownKeys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length) {
      return value;
    }
  }
  return null;
}

export async function cancelPendingChatgptLogin(loginId: string) {
  const result = await cancelAccountLogin(loginId);
  return result === "canceled"
    ? "Login cancelled."
    : "Login was already closed.";
}

export async function runAccountAction(
  action: AccountAction,
  options: {
    promptApiKey: () => string | null;
    openExternal: (url: string) => void;
    refreshAccount: () => Promise<unknown>;
    onChatgptLoginStarted?: (loginId: string) => void;
  },
) {
  if (!isTauri()) {
    throw new Error("Account login is available in the desktop app runtime.");
  }

  if (action === "logout") {
    await logoutAccount();
    await options.refreshAccount();
    return "Signed out.";
  }

  if (action === "login-api-key") {
    const apiKey = options.promptApiKey();
    if (!apiKey?.trim()) {
      throw new AccountActionCancelledError();
    }
    const result = await startAccountLogin("apiKey", apiKey.trim());
    const url = readLoginUrl(result);
    const loginId = readLoginId(result);
    const resultType =
      result && typeof result === "object" && typeof result.type === "string"
        ? result.type
        : null;
    if (url) {
      options.openExternal(url);
    }
    if (resultType === "chatgpt") {
      if (loginId) {
        options.onChatgptLoginStarted?.(loginId);
      }
      return "Complete sign-in in your browser.";
    }
    await options.refreshAccount();
    return "Signed in.";
  }

  const result = await startAccountLogin("chatgpt");
  const url = readLoginUrl(result);
  const loginId = readLoginId(result);
  if (url) {
    options.openExternal(url);
  }
  if (loginId) {
    options.onChatgptLoginStarted?.(loginId);
  }
  return "Complete sign-in in your browser.";
}
