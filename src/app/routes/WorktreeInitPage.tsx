import { Link, useParams } from "@tanstack/react-router";

export function WorktreeInitPage() {
  const { pendingId } = useParams({ from: "/worktree-init-v2/$pendingId" });

  return (
    <div className="space-y-4">
      <section className="surface-panel p-5">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-400">
          Worktree init
        </p>
        <h1 className="mt-2 font-display text-2xl text-ink-50">
          Pending worktree bootstrap
        </h1>
        <p className="mt-2 text-sm text-ink-300">
          Request <span className="font-mono text-xs">{pendingId}</span> is
          waiting for workspace and runtime readiness.
        </p>
      </section>
      <section className="surface-panel animate-codex-dialog-enter p-4 text-sm text-ink-300">
        <p>
          If this request stays pending, verify workspace selection and worktree
          settings, then retry from the thread action that created this job.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link
            to="/settings/$section"
            params={{ section: "worktrees" }}
            className="btn-flat"
          >
            Open worktree settings
          </Link>
          <Link to="/" className="btn-flat">
            Return to new thread
          </Link>
        </div>
      </section>
    </div>
  );
}
