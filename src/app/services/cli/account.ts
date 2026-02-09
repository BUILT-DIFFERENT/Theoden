import { isRecord, type JsonObject } from "@/app/services/cli/appServerPayload";
import { requestAppServer } from "@/app/services/cli/rpc";

export type AccountLoginMode = "chatgpt" | "apiKey" | "chatgptAuthTokens";

export interface ChatgptAuthTokens {
  idToken: string;
  accessToken: string;
}

export interface AccountInfo {
  isAuthenticated: boolean;
  email: string | null;
  organizationName: string | null;
  authMethod: string | null;
  requiresOpenaiAuth: boolean;
}

interface AccountReadResponse {
  account?: JsonObject | null;
  requiresOpenaiAuth?: boolean;
  [key: string]: unknown;
}

interface AccountLoginStartResponse {
  type?: string;
  loginId?: string;
  authUrl?: string;
  [key: string]: unknown;
}

interface AccountRateLimitWindow {
  usedPercent?: number;
  windowDurationMins?: number;
  resetsAt?: number;
  [key: string]: unknown;
}

interface AccountRateLimitSnapshot {
  primary?: AccountRateLimitWindow | null;
  secondary?: AccountRateLimitWindow | null;
  [key: string]: unknown;
}

interface AccountRateLimitsResponse {
  rateLimits?: AccountRateLimitSnapshot | null;
}

interface AccountCancelLoginResponse {
  status?: "canceled" | "notFound";
}

let cachedExternalChatgptTokens: ChatgptAuthTokens | null = null;

function readString(record: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length) {
      return value;
    }
  }
  return null;
}

function readBoolean(record: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return null;
}

function parseAccountInfo(response: AccountReadResponse): AccountInfo {
  const source = isRecord(response.account) ? response.account : null;
  const requiresOpenaiAuth = Boolean(response.requiresOpenaiAuth);
  if (!source) {
    return {
      isAuthenticated: false,
      email: null,
      organizationName: null,
      authMethod: null,
      requiresOpenaiAuth,
    };
  }

  const email = readString(source, ["email", "userEmail", "username", "login"]);
  const accountType = readString(source, ["type"]);
  const planType = readString(source, ["planType"]);
  const organizationName =
    readString(source, [
      "organizationName",
      "organization",
      "orgName",
      "workspaceName",
    ]) ?? (accountType === "apiKey" ? "API key" : planType);
  const authMethod = readString(source, [
    "type",
    "authMethod",
    "provider",
    "loginMethod",
  ]);

  const isAuthenticated =
    readBoolean(source, [
      "isAuthenticated",
      "authenticated",
      "loggedIn",
      "signedIn",
    ]) ?? Boolean(source);

  return {
    isAuthenticated,
    email,
    organizationName,
    authMethod,
    requiresOpenaiAuth,
  };
}

export async function readAccount(options?: { refreshToken?: boolean }) {
  const result = await requestAppServer<AccountReadResponse>({
    method: "account/read",
    params: {
      refreshToken: options?.refreshToken ?? false,
    },
  });
  return parseAccountInfo(result ?? {});
}

export function getCachedExternalChatgptTokens() {
  return cachedExternalChatgptTokens;
}

export function clearCachedExternalChatgptTokens() {
  cachedExternalChatgptTokens = null;
}

function normalizeLoginParams(
  mode: AccountLoginMode,
  value?: string | ChatgptAuthTokens,
) {
  if (mode === "apiKey") {
    const apiKey = typeof value === "string" ? value.trim() : "";
    if (!apiKey) {
      throw new Error("API key is required.");
    }
    return {
      type: "apiKey" as const,
      apiKey,
    };
  }

  if (mode === "chatgptAuthTokens") {
    const tokens = isRecord(value)
      ? {
          idToken:
            typeof value.idToken === "string" ? value.idToken.trim() : "",
          accessToken:
            typeof value.accessToken === "string"
              ? value.accessToken.trim()
              : "",
        }
      : {
          idToken: "",
          accessToken: "",
        };
    if (!tokens.idToken || !tokens.accessToken) {
      throw new Error("Both idToken and accessToken are required.");
    }
    cachedExternalChatgptTokens = tokens;
    return {
      type: "chatgptAuthTokens" as const,
      idToken: tokens.idToken,
      accessToken: tokens.accessToken,
    };
  }

  return {
    type: "chatgpt" as const,
  };
}

export async function startAccountLogin(
  mode: AccountLoginMode,
  value?: string | ChatgptAuthTokens,
) {
  const params = normalizeLoginParams(mode, value);

  const result = await requestAppServer<AccountLoginStartResponse>({
    method: "account/login/start",
    params,
  });
  return result ?? {};
}

export async function cancelAccountLogin(loginId: string) {
  const trimmedLoginId = loginId.trim();
  if (!trimmedLoginId) {
    throw new Error("loginId is required.");
  }
  const result = await requestAppServer<AccountCancelLoginResponse>({
    method: "account/login/cancel",
    params: {
      loginId: trimmedLoginId,
    },
  });
  return result?.status ?? "notFound";
}

export async function logoutAccount() {
  const result = await requestAppServer({
    method: "account/logout",
    params: {},
  });
  clearCachedExternalChatgptTokens();
  return result;
}

export async function readAccountRateLimits() {
  const result = await requestAppServer<AccountRateLimitsResponse>({
    method: "account/rateLimits/read",
    params: {},
  });
  return result?.rateLimits ?? null;
}
