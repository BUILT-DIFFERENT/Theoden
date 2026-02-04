export type ApprovalKind = "command" | "fileChange";

export interface ApprovalRequest {
  id: string;
  rawId: string | number;
  threadId: string;
  turnId: string;
  itemId: string;
  kind: ApprovalKind;
  command?: string;
  cwd?: string;
  reason?: string;
}

const approvals = new Map<string, ApprovalRequest>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeApprovals(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getApprovals(threadId?: string) {
  const list = Array.from(approvals.values());
  if (!threadId) return list;
  return list.filter((approval) => approval.threadId === threadId);
}

export function registerApprovalRequest(request: {
  id: string | number;
  method: string;
  params?: Record<string, any>;
}) {
  const params = request.params ?? {};
  const threadId = params.threadId;
  const turnId = params.turnId;
  const itemId = params.itemId ?? params.item?.id;
  if (!threadId || !turnId || !itemId) return;

  const kind: ApprovalKind = request.method.includes("commandExecution")
    ? "command"
    : "fileChange";
  const command = params.command?.join(" ");
  const cwd = params.cwd;

  approvals.set(request.id, {
    id: String(request.id),
    rawId: request.id,
    threadId,
    turnId,
    itemId,
    kind,
    command,
    cwd,
    reason: params.reason
  });
  emit();
}

export function resolveApproval(id: string) {
  approvals.delete(id);
  emit();
}
