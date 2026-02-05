import { useParams } from "@tanstack/react-router";

import { DiffPanel } from "@/app/components/diff/DiffPanel";
import { RunTimeline } from "@/app/components/runs/RunTimeline";
import { ApprovalsPanel } from "@/app/components/threads/ApprovalsPanel";
import { ThreadComposer } from "@/app/components/threads/ThreadComposer";
import { ThreadMetaPanel } from "@/app/components/threads/ThreadMetaPanel";
import { useThreadDetail } from "@/app/services/cli/useThreadDetail";

export function ThreadPage() {
  const { threadId } = useParams({ from: "/threads/$threadId" });
  const { thread } = useThreadDetail(threadId);
  return (
    <div className="space-y-6">
      <ThreadComposer />
      <RunTimeline />
      <DiffPanel summary={thread?.diffSummary} />
      <div className="space-y-6 lg:hidden">
        <ApprovalsPanel threadId={threadId} />
        <ThreadMetaPanel thread={thread} />
      </div>
    </div>
  );
}
