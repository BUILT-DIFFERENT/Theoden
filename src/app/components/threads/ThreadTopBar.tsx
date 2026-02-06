import { useMatchRoute } from "@tanstack/react-router";
import { ChevronDown, Copy, MoreHorizontal, Play } from "lucide-react";

import { diffStatsFromText } from "@/app/services/cli/diffSummary";
import { useThreadDiffText } from "@/app/services/cli/useThreadDiff";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { checkoutBranch } from "@/app/services/git/worktrees";
import { mockThreadDetail } from "@/app/state/mockData";
import { useThreadMetadata } from "@/app/state/threadMetadata";
import { useThreadUi } from "@/app/state/threadUi";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import type { ThreadDetail } from "@/app/types";
import { workspaceNameFromPath } from "@/app/utils/workspace";

interface ThreadTopBarProps {
  thread?: ThreadDetail;
  isNewThread?: boolean;
}

export function ThreadTopBar({ thread, isNewThread }: ThreadTopBarProps) {
  const { setActiveModal, setReviewOpen } = useThreadUi();
  const { selectedWorkspace } = useWorkspaceUi();
  const { workspaces } = useWorkspaces();
  const matchRoute = useMatchRoute();
  const threadMatch = matchRoute({ to: "/threads/$threadId" });
  const threadId = threadMatch ? threadMatch.threadId : undefined;
  const { metadata } = useThreadMetadata(threadId);
  const detail = thread ?? mockThreadDetail;
  const liveDiffText = useThreadDiffText(threadId, detail.diffText ?? "");
  const hasLiveDiff = liveDiffText.trim().length > 0;
  const liveStats = hasLiveDiff
    ? diffStatsFromText(liveDiffText)
    : {
        additions: detail.diffSummary.additions,
        deletions: detail.diffSummary.deletions,
      };
  const emptySummary = {
    filesChanged: 0,
    additions: 0,
    deletions: 0,
    files: [],
  };
  const summary = isNewThread
    ? emptySummary
    : {
        ...detail.diffSummary,
        additions: liveStats.additions,
        deletions: liveStats.deletions,
      };
  const hasChanges = !isNewThread && summary.filesChanged > 0;
  const isWorktree = !isNewThread && detail.mode === "worktree";
  const title = isNewThread ? "New thread" : detail.title;
  const resolvedWorkspace =
    selectedWorkspace ?? workspaces[0]?.path ?? "Pick a workspace";
  const subtitle = isNewThread
    ? workspaceNameFromPath(resolvedWorkspace)
    : detail.subtitle;

  const handleCheckoutLocal = async () => {
    const branch = metadata.branch ?? detail.branch;
    if (!detail.subtitle) return;
    if (!branch) return;
    try {
      await checkoutBranch(detail.subtitle, branch);
    } catch (error) {
      console.warn("Failed to checkout branch", error);
    }
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-black/20 px-6 py-4 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-lg text-ink-50">{title}</h1>
          <span className="text-xs text-ink-400">{subtitle}</span>
          <button className="rounded-full border border-white/10 p-1 text-ink-400 hover:border-flare-300">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">
          <Play className="h-3.5 w-3.5" />
          Run
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">
          Open
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {isWorktree ? (
          <>
            <button
              className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
              onClick={() => {
                void handleCheckoutLocal();
              }}
            >
              Checkout on local
            </button>
            <button
              className="rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-ink-50 hover:bg-flare-400/20"
              onClick={() => setActiveModal("branch")}
            >
              Create branch here
            </button>
          </>
        ) : hasChanges ? (
          <button
            className="flex items-center gap-2 rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-ink-50 hover:bg-flare-400/20"
            onClick={() => setActiveModal("commit")}
          >
            Commit
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          className="rounded-full border border-white/10 px-3 py-1 text-ink-300 hover:border-flare-300"
          onClick={() => setReviewOpen(true)}
        >
          +{summary.additions} -{summary.deletions}
        </button>
        <button className="rounded-full border border-white/10 p-2 text-ink-300 hover:border-flare-300">
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
