import {
  getObject,
  getString,
  type AppServerNotification,
} from "@/app/services/cli/appServerPayload";

export interface ActiveRunEntry {
  threadId: string;
  status: "running" | "needs_review" | "done" | "failed";
  label: string;
  updatedAt: number;
}

const RUNNING_LABEL = "Running";
const REVIEW_LABEL = "Needs review";
const COMPLETED_LABEL = "Completed";

const activeRuns = new Map<string, ActiveRunEntry>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeActiveRuns(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getActiveRuns() {
  return Array.from(activeRuns.values()).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}

function labelFromNotification(notification: AppServerNotification) {
  if (notification.method === "turn/completed") return COMPLETED_LABEL;
  if (notification.method.includes("requestApproval")) return REVIEW_LABEL;
  return RUNNING_LABEL;
}

function statusFromNotification(
  notification: AppServerNotification,
): ActiveRunEntry["status"] {
  if (notification.method.includes("requestApproval")) return "needs_review";
  if (notification.method === "turn/completed") {
    const turn = notification.params
      ? getObject(notification.params, "turn")
      : undefined;
    const status = turn ? getString(turn, "status") : undefined;
    if (status === "failed") return "failed";
    return "done";
  }
  return "running";
}

function runStateFromNotification(notification: AppServerNotification) {
  return {
    status: statusFromNotification(notification),
    label: labelFromNotification(notification),
  };
}

export function registerActiveRunNotification(
  notification: AppServerNotification,
) {
  const threadId = notification.params
    ? getString(notification.params, "threadId")
    : undefined;
  if (!threadId) return;

  if (notification.method === "turn/completed") {
    activeRuns.delete(threadId);
    emit();
    return;
  }

  const { label, status } = runStateFromNotification(notification);
  const entry: ActiveRunEntry = {
    threadId,
    status,
    label,
    updatedAt: Date.now(),
  };

  activeRuns.set(threadId, entry);
  emit();
}
