import type { AppServerNotification } from "@/app/services/cli/eventMapper";

export interface ActiveRunEntry {
  threadId: string;
  status: "running" | "needs_review" | "done" | "failed";
  label: string;
  updatedAt: number;
}

const activeRuns = new Map<string, ActiveRunEntry>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeActiveRuns(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getActiveRuns() {
  return Array.from(activeRuns.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

function labelFromNotification(notification: AppServerNotification) {
  if (notification.method === "turn/started") return "Running";
  if (notification.method === "turn/completed") return "Completed";
  if (notification.method.includes("requestApproval")) return "Needs review";
  return "Running";
}

function statusFromNotification(notification: AppServerNotification) {
  if (notification.method.includes("requestApproval")) return "needs_review";
  if (notification.method === "turn/completed") {
    const status = notification.params?.turn?.status;
    if (status === "failed") return "failed";
    return "done";
  }
  return "running";
}

export function registerActiveRunNotification(notification: AppServerNotification) {
  const threadId = notification.params?.threadId;
  if (!threadId) return;

  if (notification.method === "turn/completed") {
    activeRuns.delete(threadId);
    emit();
    return;
  }

  const entry: ActiveRunEntry = {
    threadId,
    status: statusFromNotification(notification),
    label: labelFromNotification(notification),
    updatedAt: Date.now()
  };

  activeRuns.set(threadId, entry);
  emit();
}
