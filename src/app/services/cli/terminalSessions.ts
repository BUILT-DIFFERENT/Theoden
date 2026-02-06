import {
  getNumber,
  getObject,
  getString,
  type AppServerNotification,
} from "@/app/services/cli/appServerPayload";
import {
  execCommand,
  type CommandExecResult,
} from "@/app/services/cli/commands";
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

const STORAGE_KEY = "codex.terminal.sessions";
const MAX_SESSIONS = 40;
const MAX_ENTRIES_PER_SESSION = 500;
const NEWLINE_REGEX = /\r?\n/;

const sessions = new Map<string, TerminalSession>();
const commandStreamEntryByItemKey = new Map<string, string>();
const listeners = new Set<() => void>();
let hasLoaded = false;
let entryNonce = 0;

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
    }
  });
}

function emit() {
  persistSessions();
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

function loadSessions() {
  if (hasLoaded) {
    return;
  }
  hasLoaded = true;
  if (typeof window === "undefined") {
    return;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return;
    }
    parsed.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      const record = entry as Record<string, unknown>;
      const key = typeof record.key === "string" ? record.key : null;
      if (!key) {
        return;
      }
      const scopeRecord =
        record.scope && typeof record.scope === "object"
          ? (record.scope as Record<string, unknown>)
          : {};
      const scope = normalizeScope({
        threadId:
          typeof scopeRecord.threadId === "string"
            ? scopeRecord.threadId
            : undefined,
        workspacePath:
          typeof scopeRecord.workspacePath === "string"
            ? scopeRecord.workspacePath
            : undefined,
      });
      const entries = Array.isArray(record.entries)
        ? record.entries
            .map((rawEntry) => {
              if (!rawEntry || typeof rawEntry !== "object") {
                return null;
              }
              const entryRecord = rawEntry as Record<string, unknown>;
              const id =
                typeof entryRecord.id === "string" ? entryRecord.id : null;
              const kind = entryRecord.kind;
              const text =
                typeof entryRecord.text === "string" ? entryRecord.text : null;
              const createdAt =
                typeof entryRecord.createdAt === "number"
                  ? entryRecord.createdAt
                  : Date.now();
              if (
                !id ||
                !text ||
                (kind !== "input" &&
                  kind !== "stdout" &&
                  kind !== "stderr" &&
                  kind !== "system")
              ) {
                return null;
              }
              return {
                id,
                kind,
                text,
                createdAt,
              } satisfies TerminalEntry;
            })
            .filter((entry): entry is TerminalEntry => entry !== null)
        : [];
      const updatedAt =
        typeof record.updatedAt === "number" ? record.updatedAt : Date.now();
      const isRunning =
        typeof record.isRunning === "boolean" ? record.isRunning : false;
      sessions.set(key, {
        key,
        scope,
        entries: trimEntries(entries),
        updatedAt,
        isRunning,
      });
    });
    trimSessions();
  } catch (error) {
    console.warn("Failed to load terminal sessions", error);
  }
}

function persistSessions() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const payload = Array.from(sessions.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_SESSIONS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to persist terminal sessions", error);
  }
}

function updateSession(
  scope: TerminalSessionScope,
  updater: (session: TerminalSession) => TerminalSession,
) {
  loadSessions();
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

function appendOutput(
  scope: TerminalSessionScope,
  kind: "stdout" | "stderr",
  output: string,
) {
  if (!output.trim().length) {
    return;
  }
  output
    .split(NEWLINE_REGEX)
    .filter((line) => line.length > 0)
    .forEach((line) => appendEntry(scope, { kind, text: line }));
}

function setRunning(scope: TerminalSessionScope, isRunning: boolean) {
  updateSession(scope, (session) => ({
    ...session,
    isRunning,
    updatedAt: Date.now(),
  }));
}

function isWindowsPlatform() {
  if (typeof navigator === "undefined") {
    return false;
  }
  return navigator.userAgent.toLowerCase().includes("windows");
}

function shellCommand(command: string) {
  if (isWindowsPlatform()) {
    return ["cmd", "/d", "/s", "/c", command];
  }
  return ["sh", "-lc", command];
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

function appendCommandResult(
  scope: TerminalSessionScope,
  result: CommandExecResult,
  command: string,
) {
  appendOutput(scope, "stdout", result.stdout);
  appendOutput(scope, "stderr", result.stderr);
  appendEntry(scope, {
    kind: "system",
    text: `${command} exited with ${result.exitCode}`,
  });
}

export function subscribeTerminalSessions(listener: () => void) {
  loadSessions();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTerminalSession(scope: TerminalSessionScope) {
  loadSessions();
  const session = ensureSession(scope);
  return {
    ...session,
    scope: { ...session.scope },
    entries: [...session.entries],
  } satisfies TerminalSession;
}

export function clearTerminalSession(scope: TerminalSessionScope) {
  updateSession(scope, (session) => ({
    ...session,
    entries: [],
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
  const startedAt = Date.now();
  try {
    const result = await execCommand({
      command: shellCommand(command),
      cwd: scope.workspacePath ?? undefined,
    });
    appendCommandResult(scope, result, command);
    return result;
  } catch (error) {
    appendEntry(scope, {
      kind: "stderr",
      text: error instanceof Error ? error.message : "Command failed.",
    });
    appendEntry(scope, {
      kind: "system",
      text: `${command} failed`,
    });
    throw error;
  } finally {
    const durationMs = Date.now() - startedAt;
    appendEntry(scope, {
      kind: "system",
      text: `Completed in ${durationMs}ms`,
    });
    setRunning(scope, false);
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
    appendOutput(scope, "stdout", aggregatedOutput);
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
