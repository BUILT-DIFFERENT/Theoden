import { listCloudTasks } from "@/app/services/cli/cloudTasks";
import { runCli } from "@/app/services/cli/runner";
import type { RunEvent, RunStatus } from "@/app/types";

const MAX_EVENTS = 200;
const POLL_INTERVAL_MS = 5000;

interface CloudRunEntry {
  threadId: string;
  taskId: string | null;
  url: string | null;
  environmentId: string;
  status: "queued" | "running";
}

const activeRuns = new Map<string, CloudRunEntry>();
const eventsByThread = new Map<string, RunEvent[]>();
const listeners = new Set<() => void>();
let eventNonce = 0;

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

function appendCloudEvent(
  threadId: string,
  label: string,
  status: RunStatus,
  detail?: string,
) {
  const current = eventsByThread.get(threadId) ?? [];
  const nextEvent: RunEvent = {
    id: nextEventId("cloud"),
    timestamp: nowLabel(),
    label,
    detail,
    status,
  };
  eventsByThread.set(threadId, [...current, nextEvent].slice(-MAX_EVENTS));
  emit();
}

function taskIdFromCloudUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last || null;
  } catch {
    return null;
  }
}

function mapTaskStatus(status: "queued" | "running" | "completed" | "failed") {
  if (status === "completed") return "done" as const;
  if (status === "failed") return "failed" as const;
  return "running" as const;
}

async function pollCloudRunStatus(threadId: string) {
  while (true) {
    const run = activeRuns.get(threadId);
    if (!run) {
      return;
    }
    try {
      const { tasks } = await listCloudTasks({
        environment: run.environmentId,
        limit: 20,
      });
      const task = run.taskId
        ? tasks.find((candidate) => candidate.id === run.taskId)
        : tasks.find((candidate) => candidate.url === run.url);

      if (!task) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, POLL_INTERVAL_MS),
        );
        continue;
      }

      const mappedStatus = mapTaskStatus(task.status);
      if (task.status === "queued" && run.status !== "queued") {
        activeRuns.set(threadId, { ...run, status: "queued" });
        appendCloudEvent(
          threadId,
          "Cloud task queued",
          "running",
          task.updatedAt,
        );
      } else if (task.status === "running" && run.status !== "running") {
        activeRuns.set(threadId, { ...run, status: "running" });
        appendCloudEvent(
          threadId,
          "Cloud task running",
          "running",
          task.updatedAt,
        );
      }

      if (task.status === "completed" || task.status === "failed") {
        activeRuns.delete(threadId);
        appendCloudEvent(
          threadId,
          task.status === "completed"
            ? "Cloud task completed"
            : "Cloud task failed",
          mappedStatus,
          task.url ?? task.updatedAt,
        );
        return;
      }
    } catch (error) {
      activeRuns.delete(threadId);
      appendCloudEvent(
        threadId,
        "Cloud task polling failed",
        "failed",
        error instanceof Error
          ? error.message
          : "Unable to poll cloud task status.",
      );
      return;
    }

    await new Promise((resolve) =>
      window.setTimeout(resolve, POLL_INTERVAL_MS),
    );
  }
}

export function subscribeCloudRunEvents(listener: () => void) {
  listeners.add(listener);
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

export function cancelCloudRun(threadId: string) {
  if (!activeRuns.has(threadId)) {
    return false;
  }
  activeRuns.delete(threadId);
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
  if (activeRuns.has(params.threadId)) {
    cancelCloudRun(params.threadId);
  }

  const attempts = Math.min(Math.max(params.attempts ?? 1, 1), 4);
  appendCloudEvent(params.threadId, "Cloud task queued", "running");

  const args = [
    "cloud",
    "exec",
    "--env",
    environmentId,
    "--attempts",
    String(attempts),
    ...(params.branch?.trim() ? ["--branch", params.branch.trim()] : []),
    params.prompt,
  ];
  const result = await runCli({
    args,
    cwd: params.cwd,
  });
  if (result.code !== 0) {
    appendCloudEvent(
      params.threadId,
      "Cloud task failed to start",
      "failed",
      result.stderr.trim() || result.stdout.trim() || "Unknown cloud error.",
    );
    throw new Error(
      result.stderr.trim() ||
        result.stdout.trim() ||
        "Failed to start cloud run.",
    );
  }

  const cloudUrl = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  const taskId = cloudUrl ? taskIdFromCloudUrl(cloudUrl) : null;
  activeRuns.set(params.threadId, {
    threadId: params.threadId,
    taskId,
    url: cloudUrl ?? null,
    environmentId,
    status: "running",
  });
  appendCloudEvent(
    params.threadId,
    "Cloud task started",
    "running",
    cloudUrl ?? "Task accepted by cloud backend.",
  );
  void pollCloudRunStatus(params.threadId);
  return {
    taskId,
    url: cloudUrl ?? null,
  };
}
