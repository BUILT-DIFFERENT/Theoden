import {
  getBoolean,
  getString,
  isRecord,
  type AppServerNotification,
} from "@/app/services/cli/appServerPayload";

export interface AccountLoginCompletedEvent {
  loginId: string | null;
  success: boolean;
  error: string | null;
  legacy: boolean;
}

export interface McpOauthLoginCompletedEvent {
  name: string;
  success: boolean;
  error: string | null;
}

export interface AuthNotificationEvents {
  accountLoginCompleted?: AccountLoginCompletedEvent;
  mcpOauthLoginCompleted?: McpOauthLoginCompletedEvent;
}

type AccountLoginListener = (event: AccountLoginCompletedEvent) => void;
type McpOauthListener = (event: McpOauthLoginCompletedEvent) => void;

const accountLoginListeners = new Set<AccountLoginListener>();
const mcpOauthListeners = new Set<McpOauthListener>();

export function subscribeAccountLoginCompleted(listener: AccountLoginListener) {
  accountLoginListeners.add(listener);
  return () => {
    accountLoginListeners.delete(listener);
  };
}

export function subscribeMcpOauthLoginCompleted(listener: McpOauthListener) {
  mcpOauthListeners.add(listener);
  return () => {
    mcpOauthListeners.delete(listener);
  };
}

export function registerAuthNotification(
  notification: AppServerNotification,
): AuthNotificationEvents {
  const accountLoginCompleted = parseAccountLoginCompleted(notification);
  if (accountLoginCompleted) {
    accountLoginListeners.forEach((listener) => {
      listener(accountLoginCompleted);
    });
  }

  const mcpOauthLoginCompleted = parseMcpOauthLoginCompleted(notification);
  if (mcpOauthLoginCompleted) {
    mcpOauthListeners.forEach((listener) => {
      listener(mcpOauthLoginCompleted);
    });
  }

  return {
    accountLoginCompleted: accountLoginCompleted ?? undefined,
    mcpOauthLoginCompleted: mcpOauthLoginCompleted ?? undefined,
  };
}

function parseAccountLoginCompleted(
  notification: AppServerNotification,
): AccountLoginCompletedEvent | null {
  const params = notification.params;
  if (!params || !isRecord(params)) {
    return null;
  }

  if (notification.method === "account/login/completed") {
    const success = getBoolean(params, "success") ?? false;
    return {
      loginId: getString(params, "loginId") ?? null,
      success,
      error: getString(params, "error") ?? null,
      legacy: false,
    };
  }

  if (notification.method === "loginChatGptComplete") {
    const success = getBoolean(params, "success") ?? false;
    return {
      loginId: getString(params, "loginId") ?? null,
      success,
      error: getString(params, "error") ?? null,
      legacy: true,
    };
  }

  return null;
}

function parseMcpOauthLoginCompleted(
  notification: AppServerNotification,
): McpOauthLoginCompletedEvent | null {
  if (notification.method !== "mcpServer/oauthLogin/completed") {
    return null;
  }
  const params = notification.params;
  if (!params || !isRecord(params)) {
    return null;
  }
  const name = getString(params, "name");
  if (!name) {
    return null;
  }
  return {
    name,
    success: getBoolean(params, "success") ?? false,
    error: getString(params, "error") ?? null,
  };
}
