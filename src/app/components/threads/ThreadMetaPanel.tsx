import { useMatchRoute } from "@tanstack/react-router";
import { useState } from "react";

import { diffStatsFromText } from "@/app/services/cli/diffSummary";
import { useThreadDiffText } from "@/app/services/cli/useThreadDiff";
import { openInEditor, openPathInExplorer } from "@/app/services/desktop/open";
import { mockThreadDetail } from "@/app/state/mockData";
import { mockEditors } from "@/app/state/settingsData";
import { useThreadUi } from "@/app/state/threadUi";
import { useRuntimeSettings } from "@/app/state/useRuntimeSettings";
import type { ThreadDetail } from "@/app/types";
import { isTauri } from "@/app/utils/tauri";

interface ThreadMetaPanelProps {
  thread?: ThreadDetail;
}

export function ThreadMetaPanel({ thread }: ThreadMetaPanelProps) {
  const { setActiveModal, setReviewOpen } = useThreadUi();
  const runtimeSettings = useRuntimeSettings();
  const matchRoute = useMatchRoute();
  const threadMatch = matchRoute({ to: "/t/$threadId" });
  const threadId = threadMatch ? threadMatch.threadId : undefined;
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
  const [metaMessage, setMetaMessage] = useState<string | null>(null);
  const preferredEditor =
    mockEditors.find(
      (editor) => editor.id === runtimeSettings.openDestination,
    ) ??
    mockEditors.find((editor) => editor.detected) ??
    mockEditors[0];
  const handleReviewChanges = () => {
    setReviewOpen(true);
  };
  const handleOpenInEditor = async () => {
    if (!detail.subtitle || !isTauri()) {
      setMetaMessage("Open in editor is available in the desktop app.");
      return;
    }
    try {
      await openInEditor(detail.subtitle, preferredEditor?.command ?? "code");
      setMetaMessage("Opened workspace in editor.");
    } catch (error) {
      setMetaMessage(
        error instanceof Error ? error.message : "Failed to open in editor.",
      );
    }
  };
  const handleRevealInExplorer = async () => {
    if (!detail.subtitle || !isTauri()) {
      setMetaMessage("Reveal in explorer is available in the desktop app.");
      return;
    }
    try {
      await openPathInExplorer(detail.subtitle);
      setMetaMessage("Revealed workspace in file explorer.");
    } catch (error) {
      setMetaMessage(
        error instanceof Error ? error.message : "Failed to reveal workspace.",
      );
    }
  };
  return (
    <div className="sticky top-6 space-y-4">
      <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-4 shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
          Thread
        </p>
        <h3 className="mt-2 font-display text-lg">{detail.title}</h3>
        <p className="mt-1 text-xs text-ink-400">{detail.subtitle}</p>
        <div className="mt-4 space-y-2 text-xs text-ink-300">
          <p>Project: {detail.projectId}</p>
          <p>Mode: {detail.mode}</p>
          {detail.worktreeStrategy ? (
            <p>Workspace: {detail.worktreeStrategy}</p>
          ) : null}
          <p>Effort: {detail.effort}</p>
          <p>Status: {detail.status}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <button
            className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
            onClick={() => {
              void handleOpenInEditor();
            }}
          >
            Open in VS Code
          </button>
          <button
            className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
            onClick={() => {
              void handleRevealInExplorer();
            }}
          >
            Reveal in Explorer
          </button>
        </div>
        {metaMessage ? (
          <p className="mt-2 text-xs text-ink-400">{metaMessage}</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-4 shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
          Changes
        </p>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between text-xs text-ink-300">
            <span>{summary.filesChanged} files changed</span>
            <span>
              +{summary.additions} / -{summary.deletions}
            </span>
          </div>
          <button
            className="w-full rounded-xl border border-white/10 px-3 py-2 text-left text-sm hover:border-flare-300"
            onClick={handleReviewChanges}
          >
            {hasChanges ? "Review changes" : "Review changes (empty)"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-4 shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
          Next Actions
        </p>
        <div className="mt-3 space-y-2 text-sm">
          <button
            className="w-full rounded-xl border border-white/10 px-3 py-2 text-left hover:border-flare-300"
            onClick={handleReviewChanges}
          >
            Review changes · {summary.filesChanged} files · +{summary.additions}{" "}
            / -{summary.deletions}
          </button>
          <button
            className="w-full rounded-xl border border-white/10 px-3 py-2 text-left hover:border-flare-300"
            onClick={() => setActiveModal("commit")}
          >
            Commit and push
          </button>
          <button
            className="w-full rounded-xl border border-white/10 px-3 py-2 text-left hover:border-flare-300"
            onClick={() => setActiveModal("pr")}
          >
            Create pull request
          </button>
        </div>
      </div>
    </div>
  );
}
