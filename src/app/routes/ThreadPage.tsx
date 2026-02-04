import { RunTimeline } from "@/app/components/runs/RunTimeline";
import { ThreadComposer } from "@/app/components/threads/ThreadComposer";
import { DiffPanel } from "@/app/components/diff/DiffPanel";
import { ThreadMetaPanel } from "@/app/components/threads/ThreadMetaPanel";
import { useParams } from "@tanstack/react-router";
import { useThreadDetail } from "@/app/services/cli/useThreadDetail";
import { ApprovalsPanel } from "@/app/components/threads/ApprovalsPanel";

export function ThreadPage() {
  const { threadId } = useParams({ from: "/threads/$threadId" });
  const { thread } = useThreadDetail(threadId);
  return (
    <div className="space-y-6">
      <ThreadComposer />
      <ApprovalsPanel threadId={threadId} />
      <RunTimeline />
      <DiffPanel />
      <div className="lg:hidden">
        <ThreadMetaPanel thread={thread} />
      </div>
    </div>
  );
}
