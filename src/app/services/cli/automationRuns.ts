import {
  getObject,
  getString,
  type AppServerNotification,
} from "@/app/services/cli/appServerPayload";
import { mapNotificationToRunEvent } from "@/app/services/cli/eventMapper";
import type { RunStatus } from "@/app/types";

export interface AutomationRunEvent {
  id: string;
  timestamp: string;
  label: string;
  detail?: string;
  status: RunStatus;
}

export interface AutomationRunRecord {
  id: string;
  automationId: string;
  threadId: string;
  turnId: string | null;
  prompt: string;
  workspacePath: string;
  status: RunStatus;
  statusLabel: string;
  startedAt: number;
  updatedAt: number;
  completedAt: number | null;
  events: AutomationRunEvent[];
}

const STORAGE_KEY = "codex.automations.runs";
const MAX_RUNS = 300;
const MAX_EVENTS = 120;

const runs = new Map<string, AutomationRunRecord>();
const threadToRunId = new Map<string, string>();
const listeners = new Set<() => void>();
let loaded = false;
let runNonce = 0;

function nextRunId() {
  runNonce += 1;
  return `automation-run-${Date.now()}-${runNonce}`;
}

function emit() {
  persist();
  listeners.forEach((listener) => listener());
}

function trimRuns() {
  if (runs.size <= MAX_RUNS) {
    return;
  }
  const ordered = Array.from(runs.values()).sort(
    (a, b) => b.startedAt - a.startedAt,
  );
  const keep = new Set(ordered.slice(0, MAX_RUNS).map((run) => run.id));
  Array.from(runs.keys()).forEach((id) => {
    if (!keep.has(id)) {
      const removed = runs.get(id);
      runs.delete(id);
      if (removed) {
        threadToRunId.delete(removed.threadId);
      }
    }
  });
}

function runLabelFromStatus(status: RunStatus) {
  if (status === "needs_review") return "Needs review";
  if (status === "done") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "queued") return "Queued";
  return "Running";
}

function parseStatus(status: string | undefined): RunStatus {
  if (status === "failed") return "failed";
  if (status === "completed" || status === "done") return "done";
  if (status === "queued") return "queued";
  if (status === "interrupted" || status === "cancelled") return "failed";
  return "running";
}

function eventFromNotification(notification: AppServerNotification) {
  const mapped = mapNotificationToRunEvent(notification);
  if (mapped) {
    return {
      id: mapped.id,
      timestamp: mapped.timestamp,
      label: mapped.label,
      detail: mapped.detail,
      status: mapped.status,
    } satisfies AutomationRunEvent;
  }
  return null;
}

function load() {
  if (loaded) {
    return;
  }
  loaded = true;
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
    parsed.forEach((value) => {
      if (!value || typeof value !== "object") {
        return;
      }
      const record = value as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : null;
      const automationId =
        typeof record.automationId === "string" ? record.automationId : null;
      const threadId =
        typeof record.threadId === "string" ? record.threadId : null;
      const prompt = typeof record.prompt === "string" ? record.prompt : "";
      const workspacePath =
        typeof record.workspacePath === "string" ? record.workspacePath : "";
      const turnId = typeof record.turnId === "string" ? record.turnId : null;
      const startedAt =
        typeof record.startedAt === "number" ? record.startedAt : null;
      const updatedAt =
        typeof record.updatedAt === "number" ? record.updatedAt : Date.now();
      const completedAt =
        typeof record.completedAt === "number" ? record.completedAt : null;
      const status =
        typeof record.status === "string"
          ? parseStatus(record.status)
          : "running";
      const statusLabel =
        typeof record.statusLabel === "string"
          ? record.statusLabel
          : runLabelFromStatus(status);
      const events = Array.isArray(record.events)
        ? record.events
            .filter((event): event is AutomationRunEvent => {
              if (!event || typeof event !== "object") {
                return false;
              }
              const eventRecord = event as Record<string, unknown>;
              return (
                typeof eventRecord.id === "string" &&
                typeof eventRecord.timestamp === "string" &&
                typeof eventRecord.label === "string" &&
                typeof eventRecord.status === "string"
              );
            })
            .slice(-MAX_EVENTS)
        : [];
      if (!id || !automationId || !threadId || startedAt == null) {
        return;
      }
      const run: AutomationRunRecord = {
        id,
        automationId,
        threadId,
        turnId,
        prompt,
        workspacePath,
        status,
        statusLabel,
        startedAt,
        updatedAt,
        completedAt,
        events,
      };
      runs.set(run.id, run);
      if (!completedAt && (status === "running" || status === "needs_review")) {
        threadToRunId.set(threadId, run.id);
      }
    });
    trimRuns();
  } catch (error) {
    console.warn("Failed to load automation runs", error);
  }
}

function persist() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const payload = Array.from(runs.values())
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, MAX_RUNS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to persist automation runs", error);
  }
}

export function subscribeAutomationRuns(listener: () => void) {
  load();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAutomationRuns(automationId?: string | null) {
  load();
  const allRuns = Array.from(runs.values()).sort(
    (a, b) => b.startedAt - a.startedAt,
  );
  if (!automationId) {
    return allRuns;
  }
  return allRuns.filter((run) => run.automationId === automationId);
}

export function recordAutomationRunStart(params: {
  automationId: string;
  threadId: string;
  turnId: string | null;
  prompt: string;
  workspacePath: string;
}) {
  load();
  const startedAt = Date.now();
  const run: AutomationRunRecord = {
    id: nextRunId(),
    automationId: params.automationId,
    threadId: params.threadId,
    turnId: params.turnId,
    prompt: params.prompt,
    workspacePath: params.workspacePath,
    status: "running",
    statusLabel: runLabelFromStatus("running"),
    startedAt,
    updatedAt: startedAt,
    completedAt: null,
    events: [
      {
        id: `${params.threadId}-start-${startedAt}`,
        timestamp: new Date(startedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        label: "Automation run started",
        status: "running",
      },
    ],
  };
  runs.set(run.id, run);
  threadToRunId.set(run.threadId, run.id);
  trimRuns();
  emit();
  return run;
}

export function recordAutomationRunFailure(params: {
  automationId: string;
  workspacePath: string;
  prompt: string;
  errorMessage: string;
}) {
  load();
  const startedAt = Date.now();
  const run: AutomationRunRecord = {
    id: nextRunId(),
    automationId: params.automationId,
    threadId: `failed-${startedAt}`,
    turnId: null,
    prompt: params.prompt,
    workspacePath: params.workspacePath,
    status: "failed",
    statusLabel: runLabelFromStatus("failed"),
    startedAt,
    updatedAt: startedAt,
    completedAt: startedAt,
    events: [
      {
        id: `failed-${startedAt}`,
        timestamp: new Date(startedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        label: "Automation run failed",
        detail: params.errorMessage,
        status: "failed",
      },
    ],
  };
  runs.set(run.id, run);
  trimRuns();
  emit();
  return run;
}

export function registerAutomationRunNotification(
  notification: AppServerNotification,
) {
  load();
  const threadId = notification.params
    ? getString(notification.params, "threadId")
    : undefined;
  if (!threadId) {
    return;
  }
  const runId = threadToRunId.get(threadId);
  if (!runId) {
    return;
  }
  const current = runs.get(runId);
  if (!current) {
    threadToRunId.delete(threadId);
    return;
  }
  const turn = notification.params
    ? getObject(notification.params, "turn")
    : undefined;
  const turnId = turn ? getString(turn, "id") : undefined;
  let status: RunStatus = current.status;
  let completedAt = current.completedAt;

  if (notification.method.includes("requestApproval")) {
    status = "needs_review";
  }
  if (notification.method === "turn/completed") {
    const turnStatus = turn ? getString(turn, "status") : undefined;
    status = parseStatus(turnStatus);
    completedAt = Date.now();
    threadToRunId.delete(threadId);
  } else if (notification.method === "turn/started") {
    status = "running";
  }

  const mappedEvent = eventFromNotification(notification);
  const events = mappedEvent
    ? [...current.events, mappedEvent].slice(-MAX_EVENTS)
    : current.events;
  const next: AutomationRunRecord = {
    ...current,
    turnId: turnId ?? current.turnId,
    status,
    statusLabel: runLabelFromStatus(status),
    updatedAt: Date.now(),
    completedAt,
    events,
  };
  runs.set(next.id, next);
  emit();
}
