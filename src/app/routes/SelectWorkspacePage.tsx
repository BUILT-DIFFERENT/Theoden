import { Link, useNavigate } from "@tanstack/react-router";

import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import { workspaceNameFromPath } from "@/app/utils/workspace";

export function SelectWorkspacePage() {
  const navigate = useNavigate();
  const { workspaces, isLoading } = useWorkspaces();
  const { selectedWorkspace, setSelectedWorkspace, setWorkspacePickerOpen } =
    useWorkspaceUi();

  return (
    <section className="surface-panel max-w-3xl p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
        Workspaces
      </p>
      <h1 className="mt-2 font-display text-2xl text-ink-50">
        Select workspace
      </h1>
      <p className="mt-2 text-sm text-ink-300">
        Pick a default workspace for new threads and composer runs.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="rounded-full border border-white/10 px-4 py-2 text-sm text-ink-100 hover:border-flare-300"
          onClick={() => setWorkspacePickerOpen(true)}
        >
          Add workspace
        </button>
        <Link
          to="/"
          className="rounded-full border border-white/10 px-4 py-2 text-sm text-ink-100 hover:border-flare-300"
        >
          Back to thread
        </Link>
      </div>
      <div className="mt-4 space-y-2">
        {isLoading ? (
          <p className="text-sm text-ink-400">Loading workspaces…</p>
        ) : workspaces.length ? (
          workspaces.map((workspace) => {
            const selected =
              selectedWorkspace &&
              selectedWorkspace.toLowerCase() === workspace.path.toLowerCase();
            return (
              <button
                key={workspace.path}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                  selected
                    ? "border-flare-300 bg-flare-400/10 text-ink-50"
                    : "border-white/10 bg-black/20 text-ink-300 hover:border-flare-300"
                }`}
                onClick={() => {
                  setSelectedWorkspace(workspace.path);
                  void navigate({ to: "/" });
                }}
              >
                <p className="text-sm">{workspace.name}</p>
                <p className="mt-1 text-xs text-ink-500">
                  {workspaceNameFromPath(workspace.path)} · {workspace.path}
                </p>
              </button>
            );
          })
        ) : (
          <p className="text-sm text-ink-400">
            No workspaces available yet. Use{" "}
            <span className="text-ink-200">Add workspace</span>.
          </p>
        )}
      </div>
    </section>
  );
}
