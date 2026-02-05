import { useCallback } from "react";

import {
  markApprovalError,
  resolveApproval,
  setApprovalDecision,
} from "@/app/services/cli/approvals";
import { respondAppServerRequest } from "@/app/services/cli/appServer";
import { useApprovals } from "@/app/services/cli/useApprovals";

interface ApprovalsPanelProps {
  threadId?: string;
}

export function ApprovalsPanel({ threadId }: ApprovalsPanelProps) {
  const approvals = useApprovals(threadId);
  const handleDecision = useCallback(
    async (
      approval: (typeof approvals)[number],
      decision: "accept" | "acceptForSession" | "decline",
    ) => {
      try {
        setApprovalDecision(approval.id, decision);
        await respondAppServerRequest(approval.rawId, { decision });
      } catch (error) {
        console.warn("Failed to respond to approval request", error);
        markApprovalError(
          approval.id,
          error instanceof Error ? error.message : "Failed to respond",
        );
      }
    },
    [],
  );

  if (!approvals.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-4 shadow-card">
      <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
        Approvals
      </p>
      <div className="mt-3 space-y-3 text-sm">
        {approvals.map((approval) => (
          <div
            key={approval.id}
            className="rounded-xl border border-white/10 bg-black/20 p-3"
          >
            <p className="text-ink-100">
              {approval.kind === "command"
                ? "Command approval"
                : "File change approval"}
            </p>
            <p className="mt-1 text-xs text-ink-400">
              {approval.status === "pending"
                ? "Awaiting decision"
                : approval.decision === "acceptForSession"
                  ? "Approved for session"
                  : approval.decision === "accept"
                    ? "Approved"
                    : approval.decision === "decline"
                      ? "Declined"
                      : "Updated"}
              {approval.status === "responded" ? " · Awaiting result" : ""}
              {approval.status === "completed" ? " · Completed" : ""}
              {approval.status === "failed" ? " · Failed" : ""}
              {approval.status === "declined" && approval.decision !== "decline"
                ? " · Declined"
                : ""}
            </p>
            {approval.reason ? (
              <p className="mt-1 text-xs text-ink-400">{approval.reason}</p>
            ) : null}

            {approval.kind === "command" ? (
              <div className="mt-3 space-y-2 text-xs text-ink-300">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.2em] text-ink-500">
                    Command
                  </p>
                  <p className="mt-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1 font-mono text-[0.7rem] text-ink-200">
                    {approval.command ?? "Command preview pending"}
                  </p>
                </div>
                {approval.commandActions?.length ? (
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-[0.2em] text-ink-500">
                      Actions
                    </p>
                    <div className="mt-1 space-y-1">
                      {approval.commandActions.map((action, index) => (
                        <p
                          key={`${approval.id}-action-${index}`}
                          className="text-xs text-ink-400"
                        >
                          {action}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
                {approval.cwd ? (
                  <p className="text-xs text-ink-500">CWD: {approval.cwd}</p>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 space-y-2 text-xs text-ink-300">
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-ink-500">
                  Files
                </p>
                {approval.files?.length ? (
                  <div className="space-y-2">
                    {approval.files.slice(0, 4).map((file) => (
                      <div
                        key={`${approval.id}-${file.path}`}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate text-ink-200">
                          {file.path}
                        </span>
                        <span className="shrink-0 text-ink-500">
                          +{file.additions} / -{file.deletions}
                        </span>
                      </div>
                    ))}
                    {approval.files.length > 4 ? (
                      <p className="text-xs text-ink-500">
                        {approval.files.length - 4} more files…
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-ink-500">
                    Awaiting file list from agent.
                  </p>
                )}
              </div>
            )}
            {approval.error ? (
              <p className="mt-2 text-xs text-rose-300">{approval.error}</p>
            ) : null}
            <div className="mt-3 flex gap-2 text-xs">
              <button
                className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300 disabled:cursor-not-allowed disabled:border-white/5 disabled:text-ink-500"
                onClick={() => void handleDecision(approval, "accept")}
                disabled={approval.status !== "pending"}
              >
                Accept
              </button>
              <button
                className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300 disabled:cursor-not-allowed disabled:border-white/5 disabled:text-ink-500"
                onClick={() =>
                  void handleDecision(approval, "acceptForSession")
                }
                disabled={approval.status !== "pending"}
              >
                Accept for session
              </button>
              <button
                className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300 disabled:cursor-not-allowed disabled:border-white/5 disabled:text-ink-500"
                onClick={() => void handleDecision(approval, "decline")}
                disabled={approval.status !== "pending"}
              >
                Decline
              </button>
              {approval.status === "completed" ||
              approval.status === "failed" ||
              approval.status === "declined" ? (
                <button
                  className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
                  onClick={() => resolveApproval(approval.id)}
                >
                  Dismiss
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
