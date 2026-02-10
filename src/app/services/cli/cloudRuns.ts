import {
  cancelHostCloudRun,
  listHostCloudRuns,
  startHostCloudRun,
  subscribeHostCloudRunEvents,
  type HostCloudRunCompletedEvent,
  type HostCloudRunDescriptor,
  type HostCloudRunOutputEvent,
  type HostCloudRunStatusEvent,
} from "@/app/services/host/cloudRuns";
import type { RunEvent, RunStatus } from "@/app/types";
import { isTauri } from "@/app/utils/tauri";

const MAX_EVENTS = 300;

interface CloudRunEntry {
  runId: string;
  threadId: string;
  taskId: string | null;
  url: string | null;
  environmentId: string;
  status: "queued" | "running" | "completed" | "failed" | "interrupted";
}

const activeRuns = new Map<string, CloudRunEntry>();
const eventsByThread = new Map<string, RunEvent[]>();
const listeners = new Set<() => void>();
let eventNonce = 0;
let cloudSubscriptionsReady = false;

function nowLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nextEventId(prefix: string) {
  eventNonce += 1;
  return `${prefix}-${Date.now()}-${eventNonce}`;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function mapCloudStatus(status: CloudRunEntry["status"]): RunStatus {
  if (status === "completed") {
    return "done";
  }
  if (status === "interrupted" || status === "failed") {
    return "failed";
  }
  return "running";
}

function appendCloudEvent(
  threadId: string,
  label: string,
  status: RunStatus,
  detail?: string | null,
) {
  const current = eventsByThread.get(threadId) ?? [];
  const nextEvent: RunEvent = {
    id: nextEventId("cloud"),
    timestamp: nowLabel(),
    label,
    detail: detail ?? undefined,
    status,
  };
  eventsByThread.set(threadId, [...current, nextEvent].slice(-MAX_EVENTS));
  emit();
}

function updateEntryFromDescriptor(descriptor: HostCloudRunDescriptor) {
  activeRuns.set(descriptor.threadId, {
    runId: descriptor.runId,
    threadId: descriptor.threadId,
    taskId: descriptor.taskId,
    url: descriptor.url,
    environmentId: descriptor.environmentId,
    status: descriptor.status,
  });
}

function handleStatusEvent(event: HostCloudRunStatusEvent) {
  const current = activeRuns.get(event.threadId);
  const next: CloudRunEntry = {
    runId: event.runId,
    threadId: event.threadId,
    taskId: event.taskId,
    url: event.url,
    environmentId: current?.environmentId ?? "cloud",
    status: event.status,
  };
  activeRuns.set(event.threadId, next);
  appendCloudEvent(
    event.threadId,
    `Cloud task ${event.status}`,
    mapCloudStatus(event.status),
    event.detail,
  );
}

function handleOutputEvent(event: HostCloudRunOutputEvent) {
  const trimmed = event.data.trim();
  if (!trimmed.length) {
    return;
  }
  appendCloudEvent(event.threadId, "Cloud output", "running", trimmed);
}

function handleCompletedEvent(event: HostCloudRunCompletedEvent) {
  activeRuns.delete(event.threadId);
  appendCloudEvent(
    event.threadId,
    `Cloud task ${event.status}`,
    mapCloudStatus(event.status),
    event.error ?? event.url ?? null,
  );
}

async function ensureSubscribedToHostCloudEvents() {
  if (!isTauri()) {
    return;
  }
  if (cloudSubscriptionsReady) {
    return;
  }
  cloudSubscriptionsReady = true;
  const snapshots = await listHostCloudRuns().catch(() => []);
  snapshots.forEach((snapshot) => {
    if (snapshot.status === "completed" || snapshot.status === "failed") {
      return;
    }
    updateEntryFromDescriptor(snapshot);
  });
  await subscribeHostCloudRunEvents({
    onStarted: (event) => {
      updateEntryFromDescriptor(event);
      appendCloudEvent(
        event.threadId,
        "Cloud task queued",
        "running",
        event.url,
      );
    },
    onStatus: (event) => {
      handleStatusEvent(event);
    },
    onOutput: (event) => {
      handleOutputEvent(event);
    },
    onCompleted: (event) => {
      handleCompletedEvent(event);
    },
  });
}

export function subscribeCloudRunEvents(listener: () => void) {
  listeners.add(listener);
  void ensureSubscribedToHostCloudEvents();
  return () => {
    listeners.delete(listener);
  };
}

export function cloudRunEvents(threadId?: string) {
  if (!threadId) return [] as RunEvent[];
  return eventsByThread.get(threadId) ?? [];
}

export function hasActiveCloudRun(threadId?: string) {
  if (!threadId) return false;
  return activeRuns.has(threadId);
}

export async function cancelCloudRun(threadId: string) {
  const run = activeRuns.get(threadId);
  if (!run) {
    return false;
  }
  await ensureSubscribedToHostCloudEvents();
  if (isTauri()) {
    await cancelHostCloudRun({
      runId: run.runId,
      threadId,
    });
  }
  appendCloudEvent(threadId, "Cloud task interrupted", "failed");
  return true;
}

export async function startCloudRun(params: {
  threadId: string;
  prompt: string;
  environmentId: string;
  branch?: string;
  attempts?: number;
  cwd?: string;
}) {
  const environmentId = params.environmentId.trim();
  if (!environmentId) {
    throw new Error("Cloud environment is required.");
  }
  await ensureSubscribedToHostCloudEvents();

  if (!isTauri()) {
    appendCloudEvent(
      params.threadId,
      "Cloud run unavailable",
      "failed",
      "Cloud execution is available in the desktop app.",
    );
    throw new Error("Cloud execution is available in the desktop app.");
  }

  if (activeRuns.has(params.threadId)) {
    await cancelCloudRun(params.threadId);
  }

  const descriptor = await startHostCloudRun({
    threadId: params.threadId,
    prompt: params.prompt,
    environmentId,
    branch: params.branch,
    attempts: params.attempts,
    cwd: params.cwd,
  });
  updateEntryFromDescriptor(descriptor);
  appendCloudEvent(
    params.threadId,
    "Cloud task queued",
    "running",
    descriptor.url,
  );
  return {
    taskId: descriptor.taskId,
    url: descriptor.url,
  };
}
