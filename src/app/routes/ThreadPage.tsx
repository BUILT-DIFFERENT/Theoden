import { useParams } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { FilesChangedCard } from "@/app/components/diff/FilesChangedCard";
import { RunTimeline } from "@/app/components/runs/RunTimeline";
import { ApprovalsPanel } from "@/app/components/threads/ApprovalsPanel";
import { ThreadComposer } from "@/app/components/threads/ThreadComposer";
import { ThreadMetaPanel } from "@/app/components/threads/ThreadMetaPanel";
import { ThreadModals } from "@/app/components/threads/ThreadModals";
import { diffStatsFromText } from "@/app/services/cli/diffSummary";
import { useThreadDetail } from "@/app/services/cli/useThreadDetail";
import { useThreadDiffText } from "@/app/services/cli/useThreadDiff";
import { mockThreadDetail } from "@/app/state/mockData";
import { useThreadUi } from "@/app/state/threadUi";

export function ThreadPage() {
  const { threadId } = useParams({ from: "/threads/$threadId" });
  const { thread } = useThreadDetail(threadId);
  const { setReviewOpen } = useThreadUi();
  const detail = thread ?? mockThreadDetail;
  const liveDiffText = useThreadDiffText(threadId, detail.diffText ?? "");
  const hasLiveDiff = liveDiffText.trim().length > 0;
  const diffStats = hasLiveDiff
    ? diffStatsFromText(liveDiffText)
    : {
        additions: detail.diffSummary.additions,
        deletions: detail.diffSummary.deletions,
      };
  const summary = {
    ...detail.diffSummary,
    additions: diffStats.additions,
    deletions: diffStats.deletions,
  };
  const hasChanges = summary.filesChanged > 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="max-w-[70%] rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-ink-100">
          {detail.title}
        </div>
      </div>

      <RunTimeline />

      <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-4 shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
          Summary
        </p>
        <p className="mt-2 text-sm text-ink-200">
          Updated {summary.filesChanged} files to deliver the requested changes
          in {detail.projectId}. Review the diff and commit when ready.
        </p>
        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
            Files touched
          </p>
          <div className="mt-2 space-y-1 text-xs text-ink-300">
            {summary.files.map((file) => (
              <div key={file.path} className="flex items-center gap-2">
                <span className="text-sky-300 underline">{file.path}</span>
                <span className="text-ink-500">
                  +{file.additions} / -{file.deletions}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
            Next steps
          </p>
          <ul className="mt-2 space-y-1 text-xs text-ink-300">
            <li>Review the diff for accuracy.</li>
            <li>Run tests if needed.</li>
            <li>Create a branch and open a PR.</li>
          </ul>
        </div>
        <p className="mt-4 text-xs text-ink-500">
          Tests not run (per instruction).
        </p>
      </div>

      <FilesChangedCard summary={summary} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <ApprovalsPanel threadId={threadId} />
        <ThreadMetaPanel thread={thread} />
      </div>

      <div className="sticky bottom-4 z-10 space-y-3">
        {hasChanges ? (
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-ink-900/80 px-4 py-3 text-xs text-ink-200 shadow-card">
            <span>
              {summary.filesChanged} file changed +{summary.additions} -
              {summary.deletions}
            </span>
            <button
              className="flex items-center gap-2 rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-ink-50 hover:bg-flare-400/20"
              onClick={() => setReviewOpen(true)}
            >
              Review changes
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        <ThreadComposer />
      </div>
      <ThreadModals thread={thread} />
    </div>
  );
}
