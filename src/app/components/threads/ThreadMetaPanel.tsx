import { mockThreadDetail } from "@/app/state/mockData";
import type { ThreadDetail } from "@/app/types";

interface ThreadMetaPanelProps {
  thread?: ThreadDetail;
}

export function ThreadMetaPanel({ thread }: ThreadMetaPanelProps) {
  const detail = thread ?? mockThreadDetail;
  const summary = detail.diffSummary;
  const hasChanges = summary.filesChanged > 0;
  const handleReviewChanges = () => {
    const panel = document.getElementById("diff-panel");
    if (panel) {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
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
          <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">
            Open in VS Code
          </button>
          <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">
            Reveal in Explorer
          </button>
        </div>
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
          <button className="w-full rounded-xl border border-white/10 px-3 py-2 text-left hover:border-flare-300">
            Commit and push
          </button>
          <button className="w-full rounded-xl border border-white/10 px-3 py-2 text-left hover:border-flare-300">
            Bring back to main
          </button>
        </div>
      </div>
    </div>
  );
}
