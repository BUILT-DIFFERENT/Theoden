import { respondAppServerRequest } from "@/app/services/cli/appServer";
import { resolveApproval } from "@/app/services/cli/approvals";
import { useApprovals } from "@/app/services/cli/useApprovals";

interface ApprovalsPanelProps {
  threadId?: string;
}

export function ApprovalsPanel({ threadId }: ApprovalsPanelProps) {
  const approvals = useApprovals(threadId);

  if (!approvals.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-4 shadow-card">
      <p className="text-xs uppercase tracking-[0.3em] text-ink-300">Approvals</p>
      <div className="mt-3 space-y-3 text-sm">
        {approvals.map((approval) => (
            <div key={approval.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-ink-100">
                {approval.kind === "command" ? "Command approval" : "File change approval"}
              </p>
            <p className="mt-1 text-xs text-ink-400">
              {approval.command ?? approval.reason ?? "Awaiting decision"}
            </p>
            <div className="mt-3 flex gap-2 text-xs">
              <button
                className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
                onClick={async () => {
                  await respondAppServerRequest(approval.rawId, { decision: "accept" });
                  resolveApproval(approval.id);
                }}
              >
                Accept
              </button>
              <button
                className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
                onClick={async () => {
                  await respondAppServerRequest(approval.rawId, { decision: "decline" });
                  resolveApproval(approval.id);
                }}
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
