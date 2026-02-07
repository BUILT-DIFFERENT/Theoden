import {
  getNumber,
  getObject,
  getString,
  type AppServerNotification,
} from "@/app/services/cli/appServerPayload";
import {
  attachTerminalSession,
  closeTerminalSession,
  createTerminalSession,
  listTerminalSessions,
  subscribeTerminalEvents,
  writeTerminalSession,
  type HostTerminalDataEvent,
  type HostTerminalErrorEvent,
  type HostTerminalExitEvent,
  type HostTerminalSession,
} from "@/app/services/host/terminal";
import { isTauri } from "@/app/utils/tauri";
import { normalizeWorkspacePath } from "@/app/utils/workspace";

export interface TerminalSessionScope {
  threadId?: string;
  workspacePath?: string | null;
}

export interface TerminalEntry {
  id: string;
  kind: "input" | "stdout" | "stderr" | "system";
  text: string;
  createdAt: number;
}

export interface TerminalSession {
  key: string;
  scope: TerminalSessionScope;
  entries: TerminalEntry[];
  isRunning: boolean;
  updatedAt: number;
}

const MAX_SESSIONS = 40;
const MAX_ENTRIES_PER_SESSION = 500;

const sessions = new Map<string, TerminalSession>();
const scopeToHostSession = new Map<string, string>();
const hostSessionToScope = new Map<string, string>();
const commandStreamEntryByItemKey = new Map<string, string>();
const listeners = new Set<() => void>();
let entryNonce = 0;
let hostBootstrapped = false;
let hostSubscribed = false;

function nextEntryId(prefix: string) {
  entryNonce += 1;
  return `${prefix}-${Date.now()}-${entryNonce}`;
}

function normalizeScope(scope: TerminalSessionScope): TerminalSessionScope {
  const threadId = scope.threadId?.trim() || undefined;
  const workspacePath = scope.workspacePath
    ? normalizeWorkspacePath(scope.workspacePath)
    : undefined;
  return {
    threadId,
    workspacePath,
  };
}

function scopeKey(scope: TerminalSessionScope) {
  const normalized = normalizeScope(scope);
  if (normalized.threadId) {
    return `thread:${normalized.threadId}`;
  }
  if (normalized.workspacePath) {
    return `workspace:${normalized.workspacePath.toLowerCase()}`;
  }
  return "workspace:default";
}

function sessionScopeFromHost(
  session: HostTerminalSession,
): TerminalSessionScope {
  return {
    threadId: session.threadId ?? undefined,
    workspacePath: session.workspacePath ?? undefined,
  };
}

function trimEntries(entries: TerminalEntry[]) {
  if (entries.length <= MAX_ENTRIES_PER_SESSION) {
    return entries;
  }
  return entries.slice(-MAX_ENTRIES_PER_SESSION);
}

function trimSessions() {
  if (sessions.size <= MAX_SESSIONS) {
    return;
  }
  const sorted = Array.from(sessions.values()).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
  const keep = new Set(
    sorted.slice(0, MAX_SESSIONS).map((session) => session.key),
  );
  Array.from(sessions.keys()).forEach((key) => {
    if (!keep.has(key)) {
      sessions.delete(key);
      scopeToHostSession.delete(key);
    }
  });
}

function emit() {
  listeners.forEach((listener) => listener());
}

function defaultSession(scope: TerminalSessionScope): TerminalSession {
  const normalizedScope = normalizeScope(scope);
  return {
    key: scopeKey(normalizedScope),
    scope: normalizedScope,
    entries: [],
    isRunning: false,
    updatedAt: Date.now(),
  };
}

function ensureSession(scope: TerminalSessionScope) {
  const normalizedScope = normalizeScope(scope);
  const key = scopeKey(normalizedScope);
  const existing = sessions.get(key);
  if (existing) {
    return existing;
  }
  const created = defaultSession(normalizedScope);
  sessions.set(key, created);
  trimSessions();
  return created;
}

function updateSession(
  scope: TerminalSessionScope,
  updater: (session: TerminalSession) => TerminalSession,
) {
  const current = ensureSession(scope);
  const next = updater(current);
  sessions.set(next.key, next);
  trimSessions();
  emit();
}

function appendEntry(
  scope: TerminalSessionScope,
  entry: Omit<TerminalEntry, "id" | "createdAt">,
) {
  const text = entry.text;
  if (!text.length) {
    return;
  }
  updateSession(scope, (session) => {
    const nextEntries = trimEntries([
      ...session.entries,
      {
        id: nextEntryId(entry.kind),
        kind: entry.kind,
        text,
        createdAt: Date.now(),
      },
    ]);
    return {
      ...session,
      entries: nextEntries,
      updatedAt: Date.now(),
    };
  });
}

function setRunning(scope: TerminalSessionScope, isRunning: boolean) {
  updateSession(scope, (session) => ({
    ...session,
    isRunning,
    updatedAt: Date.now(),
  }));
}

async function ensureHostBootstrapped() {
  if (hostBootstrapped || !isTauri()) {
    return;
  }
  hostBootstrapped = true;
  try {
    const hostSessions = await listTerminalSessions();
    hostSessions.forEach((hostSession) => {
      const scope = sessionScopeFromHost(hostSession);
      const key = scopeKey(scope);
      const current = ensureSession(scope);
      sessions.set(key, {
        ...current,
        scope,
        isRunning: hostSession.isRunning,
        updatedAt: hostSession.updatedAt * 1000,
      });
      scopeToHostSession.set(key, hostSession.sessionId);
      hostSessionToScope.set(hostSession.sessionId, key);
      void attachTerminalSession(hostSession.sessionId);
    });
    emit();
  } catch (error) {
    console.warn("Failed to bootstrap terminal sessions", error);
  }
}

async function ensureHostSubscribed() {
  if (hostSubscribed || !isTauri()) {
    return;
  }
  hostSubscribed = true;
  await subscribeTerminalEvents({
    onAttached: (payload) => {
      const scope = sessionScopeFromHost(payload);
      const key = scopeKey(scope);
      const current = ensureSession(scope);
      sessions.set(key, {
        ...current,
        scope,
        isRunning: payload.isRunning,
        updatedAt: payload.updatedAt * 1000,
      });
      scopeToHostSession.set(key, payload.sessionId);
      hostSessionToScope.set(payload.sessionId, key);
      emit();
    },
    onData: (payload) => {
      handleHostTerminalData(payload);
    },
    onExit: (payload) => {
      handleHostTerminalExit(payload);
    },
    onError: (payload) => {
      handleHostTerminalError(payload);
    },
  });
}

function scopeForHostSession(sessionId: string): TerminalSessionScope | null {
  const key = hostSessionToScope.get(sessionId);
  if (!key) {
    return null;
  }
  return sessions.get(key)?.scope ?? null;
}

function handleHostTerminalData(payload: HostTerminalDataEvent) {
  const scope = scopeForHostSession(payload.sessionId);
  if (!scope) {
    return;
  }
  const kind =
    payload.stream === "stderr"
      ? "stderr"
      : payload.stream === "stdin"
        ? "input"
        : "stdout";
  appendEntry(scope, {
    kind,
    text: payload.data,
  });
}

function handleHostTerminalExit(payload: HostTerminalExitEvent) {
  const scope = scopeForHostSession(payload.sessionId);
  if (!scope) {
    return;
  }
  appendEntry(scope, {
    kind: "system",
    text: `command exited with ${payload.code}`,
  });
  setRunning(scope, false);
}

function handleHostTerminalError(payload: HostTerminalErrorEvent) {
  const scope = scopeForHostSession(payload.sessionId);
  if (!scope) {
    return;
  }
  appendEntry(scope, {
    kind: "stderr",
    text: payload.error,
  });
  setRunning(scope, false);
}

async function ensureHostSession(scope: TerminalSessionScope): Promise<string> {
  await ensureHostBootstrapped();
  await ensureHostSubscribed();
  const key = scopeKey(scope);
  const existing = scopeToHostSession.get(key);
  if (existing) {
    return existing;
  }
  const session = await createTerminalSession({
    threadId: scope.threadId,
    workspacePath: scope.workspacePath ?? null,
    cwd: scope.workspacePath ?? null,
  });
  scopeToHostSession.set(key, session.sessionId);
  hostSessionToScope.set(session.sessionId, key);
  return session.sessionId;
}

function notificationScope(threadId: string): TerminalSessionScope {
  return { threadId };
}

function streamEntryMapKey(threadId: string, itemId: string) {
  return `${threadId}:${itemId}`;
}

function appendStreamDelta(threadId: string, itemId: string, delta: string) {
  if (!delta.length) {
    return;
  }
  const scope = notificationScope(threadId);
  const itemKey = streamEntryMapKey(threadId, itemId);
  updateSession(scope, (session) => {
    const existingEntryId = commandStreamEntryByItemKey.get(itemKey);
    const nextEntries = [...session.entries];
    if (existingEntryId) {
      const index = nextEntries.findIndex(
        (entry) => entry.id === existingEntryId,
      );
      if (index !== -1) {
        nextEntries[index] = {
          ...nextEntries[index],
          text: `${nextEntries[index].text}${delta}`,
          createdAt: Date.now(),
        };
        return {
          ...session,
          entries: trimEntries(nextEntries),
          updatedAt: Date.now(),
        };
      }
    }
    const created = {
      id: nextEntryId("stdout"),
      kind: "stdout" as const,
      text: delta,
      createdAt: Date.now(),
    };
    commandStreamEntryByItemKey.set(itemKey, created.id);
    return {
      ...session,
      entries: trimEntries([...nextEntries, created]),
      updatedAt: Date.now(),
    };
  });
}

export function subscribeTerminalSessions(listener: () => void) {
  listeners.add(listener);
  void ensureHostBootstrapped();
  void ensureHostSubscribed();
  return () => {
    listeners.delete(listener);
  };
}

export function getTerminalSession(scope: TerminalSessionScope) {
  const session = ensureSession(scope);
  return {
    ...session,
    scope: { ...session.scope },
    entries: [...session.entries],
  } satisfies TerminalSession;
}

export async function clearTerminalSession(scope: TerminalSessionScope) {
  const key = scopeKey(scope);
  const sessionId = scopeToHostSession.get(key);
  if (sessionId) {
    try {
      await closeTerminalSession(sessionId);
    } catch (error) {
      console.warn("Failed to close host terminal session", error);
    }
    scopeToHostSession.delete(key);
    hostSessionToScope.delete(sessionId);
  }
  updateSession(scope, (session) => ({
    ...session,
    entries: [],
    isRunning: false,
    updatedAt: Date.now(),
  }));
}

export function sessionOutputText(scope: TerminalSessionScope) {
  const session = getTerminalSession(scope);
  return session.entries.map((entry) => entry.text).join("\n");
}

export async function runTerminalCommand(
  scope: TerminalSessionScope,
  commandText: string,
) {
  const command = commandText.trim();
  if (!command.length) {
    throw new Error("Enter a command to run.");
  }
  appendEntry(scope, {
    kind: "input",
    text: `$ ${command}`,
  });
  setRunning(scope, true);
  try {
    if (isTauri()) {
      const sessionId = await ensureHostSession(scope);
      await writeTerminalSession(sessionId, command);
      return;
    }
    throw new Error("Terminal commands are available in the desktop app.");
  } catch (error) {
    appendEntry(scope, {
      kind: "stderr",
      text: error instanceof Error ? error.message : "Command failed.",
    });
    setRunning(scope, false);
    throw error;
  }
}

export function registerTerminalNotification(
  notification: AppServerNotification,
) {
  const params = notification.params;
  if (!params) {
    return;
  }
  const threadId = getString(params, "threadId");
  if (!threadId) {
    return;
  }

  if (notification.method === "item/started") {
    const item = getObject(params, "item");
    if (!item || getString(item, "type") !== "commandExecution") {
      return;
    }
    const command = getString(item, "command") ?? "command";
    appendEntry(notificationScope(threadId), {
      kind: "input",
      text: `$ ${command}`,
    });
    return;
  }

  if (notification.method === "item/commandExecution/outputDelta") {
    const itemId = getString(params, "itemId");
    const delta = getString(params, "delta");
    if (!itemId || !delta) {
      return;
    }
    appendStreamDelta(threadId, itemId, delta);
    return;
  }

  if (notification.method === "item/commandExecution/terminalInteraction") {
    const stdin = getString(params, "stdin");
    if (!stdin?.length) {
      return;
    }
    appendEntry(notificationScope(threadId), {
      kind: "system",
      text: `stdin: ${stdin}`,
    });
    return;
  }

  if (notification.method !== "item/completed") {
    return;
  }
  const item = getObject(params, "item");
  if (!item || getString(item, "type") !== "commandExecution") {
    return;
  }

  const itemId = getString(item, "id");
  const scope = notificationScope(threadId);
  const streamKey = itemId ? streamEntryMapKey(threadId, itemId) : null;
  const hadStream = streamKey
    ? commandStreamEntryByItemKey.has(streamKey)
    : false;
  if (streamKey) {
    commandStreamEntryByItemKey.delete(streamKey);
  }

  const aggregatedOutput = getString(item, "aggregatedOutput");
  if (aggregatedOutput && !hadStream) {
    aggregatedOutput
      .split(/\r?\n/)
      .filter((line) => line.length > 0)
      .forEach((line) =>
        appendEntry(scope, {
          kind: "stdout",
          text: line,
        }),
      );
  }
  const status = getString(item, "status") ?? "completed";
  const exitCode = getNumber(item, "exitCode");
  appendEntry(scope, {
    kind: "system",
    text:
      typeof exitCode === "number"
        ? `command ${status} (exit ${exitCode})`
        : `command ${status}`,
  });
}
