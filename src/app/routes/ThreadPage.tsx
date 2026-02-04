import { RunTimeline } from "@/app/components/runs/RunTimeline";
import { ThreadComposer } from "@/app/components/threads/ThreadComposer";
import { DiffPanel } from "@/app/components/diff/DiffPanel";

export function ThreadPage() {
  return (
    <div className="space-y-6">
      <ThreadComposer />
      <RunTimeline />
      <DiffPanel />
    </div>
  );
}
