import {
  getArray,
  getNumber,
  getObject,
  getString,
  getStringArray,
  isRecord,
  type AppServerNotification,
  type AppServerRequest,
} from "@/app/services/cli/appServerPayload";
import { summarizeChanges } from "@/app/services/cli/diffSummary";
import type { DiffFile } from "@/app/types";

export type ApprovalKind = "command" | "fileChange";
export type ApprovalDecision =
  | "accept"
  | "acceptForSession"
  | "acceptWithExecpolicyAmendment"
  | "decline";
export type ApprovalStatus =
  | "pending"
  | "responded"
  | "completed"
  | "failed"
  | "declined";

export interface ApprovalRequest {
  id: string;
  rawId: string | number;
  threadId: string;
  turnId: string;
  itemId: string;
  kind: ApprovalKind;
  status: ApprovalStatus;
  decision?: ApprovalDecision;
  result?: "completed" | "failed" | "declined";
  error?: string;
  execPolicyAmendment?: string[];
  command?: string;
  commandActions?: string[];
  cwd?: string;
  reason?: string;
  files?: DiffFile[];
  commandOutput?: string;
  exitCode?: number;
  durationMs?: number;
}

interface ApprovalItemContext {
  itemId: string;
  kind: ApprovalKind;
  execPolicyAmendment?: string[];
  command?: string;
  commandActions?: string[];
  files?: DiffFile[];
  commandOutput?: string;
  exitCode?: number;
  durationMs?: number;
}

const approvals = new Map<string, ApprovalRequest>();
const approvalItems = new Map<string, ApprovalItemContext>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeApprovals(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getApprovals(threadId?: string) {
  const list = Array.from(approvals.values());
  if (!threadId) return list;
  return list.filter((approval) => approval.threadId === threadId);
}

export function registerApprovalRequest(request: AppServerRequest) {
  const params = request.params;
  if (!params) return;

  const threadId = getString(params, "threadId");
  const turnId = getString(params, "turnId");
  const item = getObject(params, "item");
  const itemId =
    getString(params, "itemId") ?? (item ? getString(item, "id") : undefined);
  if (!threadId || !turnId || !itemId) return;

  const kind: ApprovalKind = request.method.includes("commandExecution")
    ? "command"
    : "fileChange";
  const command = commandStringFromRecord(params);
  const commandActions = summarizeCommandActions(
    getArray(params, "commandActions"),
  );
  const cwd = getString(params, "cwd");
  const execPolicyAmendment = getStringArray(
    params,
    "proposedExecpolicyAmendment",
  );
  const context = approvalItems.get(itemId);

  approvals.set(String(request.id), {
    id: String(request.id),
    rawId: request.id,
    threadId,
    turnId,
    itemId,
    kind,
    status: "pending",
    command,
    commandActions: commandActions?.length
      ? commandActions
      : context?.commandActions,
    cwd,
    reason: getString(params, "reason"),
    execPolicyAmendment: execPolicyAmendment?.length
      ? execPolicyAmendment
      : undefined,
    files: context?.files,
    commandOutput: context?.commandOutput,
    exitCode: context?.exitCode,
    durationMs: context?.durationMs,
  });
  emit();
}

export function registerApprovalItem(notification: AppServerNotification) {
  if (
    notification.method !== "item/started" &&
    notification.method !== "item/completed"
  ) {
    return;
  }
  const params = notification.params;
  if (!params) return;
  const threadId = getString(params, "threadId");
  const turnId = getString(params, "turnId");
  const item = getObject(params, "item");
  if (!item) return;
  const itemId = getString(item, "id");
  const itemType = getString(item, "type");
  if (!threadId || !turnId || !itemId || !itemType) return;

  if (notification.method === "item/completed") {
    const status = getString(item, "status");
    if (status) {
      markApprovalResult(itemId, status);
    }
  }

  if (itemType === "fileChange") {
    const changes = getArray(item, "changes") ?? [];
    const summary = summarizeChanges(changes);
    approvalItems.set(itemId, {
      itemId,
      kind: "fileChange",
      files: summary.files,
    });
  }

  if (itemType === "commandExecution") {
    const command = commandStringFromRecord(item);
    const commandActions = summarizeCommandActions(
      getArray(item, "commandActions"),
    );
    const aggregatedOutput = getString(item, "aggregatedOutput");
    const exitCode = getNumber(item, "exitCode");
    const durationMs = getNumber(item, "durationMs");
    approvalItems.set(itemId, {
      itemId,
      kind: "command",
      command,
      commandActions: commandActions?.length ? commandActions : undefined,
      commandOutput: aggregatedOutput ?? undefined,
      exitCode,
      durationMs,
    });
  }

  approvals.forEach((approval, key) => {
    if (approval.itemId !== itemId) return;
    const context = approvalItems.get(itemId);
    if (!context) return;
    approvals.set(key, {
      ...approval,
      command: approval.command ?? context.command,
      commandActions: approval.commandActions ?? context.commandActions,
      files: approval.files ?? context.files,
      commandOutput: approval.commandOutput ?? context.commandOutput,
      exitCode: approval.exitCode ?? context.exitCode,
      durationMs: approval.durationMs ?? context.durationMs,
    });
  });
  emit();
}

export function setApprovalDecision(id: string, decision: ApprovalDecision) {
  const approval = approvals.get(id);
  if (!approval) return;
  approvals.set(id, {
    ...approval,
    decision,
    status: "responded",
  });
  emit();
}

export function markApprovalError(id: string, message: string) {
  const approval = approvals.get(id);
  if (!approval) return;
  approvals.set(id, {
    ...approval,
    status: "failed",
    error: message,
  });
  emit();
}

export function resolveApproval(id: string) {
  const approval = approvals.get(id);
  if (approval) {
    approvalItems.delete(approval.itemId);
  }
  approvals.delete(id);
  emit();
}

function commandStringFromRecord(record: Record<string, unknown>) {
  const command = getString(record, "command");
  if (command) return command;
  return getStringArray(record, "command")?.join(" ");
}

function summarizeCommandActions(actions: unknown[] | undefined) {
  if (!actions?.length) return undefined;
  const summaries = actions.reduce<string[]>((acc, action) => {
    if (!isRecord(action)) return acc;
    const type = getString(action, "type");
    if (type === "read") {
      const path = getString(action, "path");
      acc.push(path ? `Read ${path}` : "Read file");
      return acc;
    }
    if (type === "listFiles") {
      const path = getString(action, "path");
      acc.push(path ? `List files in ${path}` : "List files");
      return acc;
    }
    if (type === "search") {
      const query = getString(action, "query");
      const path = getString(action, "path");
      const location = path ? ` in ${path}` : "";
      acc.push(query ? `Search "${query}"${location}` : `Search${location}`);
      return acc;
    }
    const command = getString(action, "command");
    acc.push(command ? `Run ${command}` : "Run command");
    return acc;
  }, []);
  return summaries.length ? summaries : undefined;
}

function markApprovalResult(itemId: string, status: string) {
  approvals.forEach((approval, key) => {
    if (approval.itemId !== itemId) return;
    if (status === "declined") {
      approvals.set(key, {
        ...approval,
        status: "declined",
        result: "declined",
      });
      return;
    }
    if (status === "failed") {
      approvals.set(key, {
        ...approval,
        status: "failed",
        result: "failed",
      });
      return;
    }
    approvals.set(key, {
      ...approval,
      status: "completed",
      result: "completed",
    });
  });
  emit();
}
