import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { addWorkspace } from "@/app/services/cli/workspaces";
import { storeWorkspace } from "@/app/state/workspaces";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import { workspaceNameFromPath } from "@/app/utils/workspace";

export function WorkspaceModal() {
  const { workspacePickerOpen, setWorkspacePickerOpen, setSelectedWorkspace } =
    useWorkspaceUi();
  const { workspaces } = useWorkspaces();
  const queryClient = useQueryClient();
  const [pathInput, setPathInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const sortedWorkspaces = useMemo(
    () => workspaces.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [workspaces],
  );

  if (!workspacePickerOpen) return null;

  const handleClose = () => {
    setWorkspacePickerOpen(false);
    setError(null);
  };

  const handleAdd = async () => {
    const trimmed = pathInput.trim();
    if (!trimmed) {
      setError("Enter a workspace path to add.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await addWorkspace(trimmed);
      storeWorkspace(trimmed);
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setSelectedWorkspace(trimmed);
      setPathInput("");
      setWorkspacePickerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add workspace.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-ink-900/90 p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg text-ink-50">
            Choose a workspace
          </h3>
          <button
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-ink-300 hover:border-flare-300"
            onClick={handleClose}
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm text-ink-300">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
              Existing workspaces
            </p>
            <div className="mt-2 grid gap-2">
              {sortedWorkspaces.length ? (
                sortedWorkspaces.map((workspace) => (
                  <button
                    key={workspace.path}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-sm text-ink-100 hover:border-flare-300"
                    onClick={() => {
                      setSelectedWorkspace(workspace.path);
                      setWorkspacePickerOpen(false);
                    }}
                  >
                    <span>{workspace.name}</span>
                    <span className="text-xs text-ink-500">
                      {workspace.path}
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-xs text-ink-500">
                  No workspaces configured yet.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
              Add a workspace
            </p>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-ink-100"
              placeholder="C:\\Repos\\my-project"
              value={pathInput}
              onChange={(event) => setPathInput(event.target.value)}
            />
            {pathInput ? (
              <p className="text-xs text-ink-500">
                Will add{" "}
                <span className="text-ink-200">
                  {workspaceNameFromPath(pathInput)}
                </span>
              </p>
            ) : null}
            {error ? <p className="text-xs text-rose-300">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                className="rounded-full border border-white/10 px-3 py-1 text-xs hover:border-flare-300"
                onClick={handleClose}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className="rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-xs text-ink-50 hover:bg-flare-400/20 disabled:opacity-60"
                onClick={() => {
                  void handleAdd();
                }}
                disabled={isSaving}
              >
                {isSaving ? "Adding…" : "Add workspace"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
