import { mockThreadDetail } from "@/app/state/mockData";

export function ThreadMetaPanel() {
  return (
    <div className="sticky top-6 space-y-4">
      <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-4 shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">Thread</p>
        <h3 className="mt-2 font-display text-lg">{mockThreadDetail.title}</h3>
        <p className="mt-1 text-xs text-ink-400">{mockThreadDetail.subtitle}</p>
        <div className="mt-4 space-y-2 text-xs text-ink-300">
          <p>Project: {mockThreadDetail.project}</p>
          <p>Mode: {mockThreadDetail.mode}</p>
          {mockThreadDetail.worktreeStrategy ? (
            <p>Workspace: {mockThreadDetail.worktreeStrategy}</p>
          ) : null}
          <p>Effort: {mockThreadDetail.effort}</p>
          <p>Status: {mockThreadDetail.status}</p>
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
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">Next Actions</p>
        <div className="mt-3 space-y-2 text-sm">
          <button className="w-full rounded-xl border border-white/10 px-3 py-2 text-left hover:border-flare-300">
            Review changes
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
