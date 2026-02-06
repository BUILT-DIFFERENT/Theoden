import { useQueryClient } from "@tanstack/react-query";
import { Check, FolderOpen, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { addWorkspace, removeWorkspace } from "@/app/services/cli/workspaces";
import { pickWorkspaceDirectory } from "@/app/services/desktop/dialog";
import { removeStoredWorkspace, storeWorkspace } from "@/app/state/workspaces";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import {
  normalizeWorkspacePath,
  workspaceNameFromPath,
} from "@/app/utils/workspace";

export function WorkspaceModal() {
  const {
    workspacePickerOpen,
    setWorkspacePickerOpen,
    selectedWorkspace,
    setSelectedWorkspace,
    unavailableWorkspace,
    dismissUnavailableWorkspace,
  } = useWorkspaceUi();
  const { workspaces } = useWorkspaces();
  const queryClient = useQueryClient();
  const [pathInput, setPathInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPickingPath, setIsPickingPath] = useState(false);
  const [removingPath, setRemovingPath] = useState<string | null>(null);
  const normalizedSelectedWorkspace = selectedWorkspace
    ? normalizeWorkspacePath(selectedWorkspace).toLowerCase()
    : null;

  const sortedWorkspaces = useMemo(
    () => workspaces.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [workspaces],
  );

  if (!workspacePickerOpen) return null;

  const handleClose = () => {
    setWorkspacePickerOpen(false);
    setError(null);
  };

  const handleRemoveWorkspace = async (path: string) => {
    setRemovingPath(path);
    setError(null);
    try {
      await removeWorkspace(path);
    } catch (removeError) {
      console.warn("Failed to remove workspace from config", removeError);
    }
    try {
      removeStoredWorkspace(path);
      if (
        normalizedSelectedWorkspace ===
        normalizeWorkspacePath(path).toLowerCase()
      ) {
        setSelectedWorkspace(null);
      }
      if (
        unavailableWorkspace &&
        normalizeWorkspacePath(unavailableWorkspace).toLowerCase() ===
          normalizeWorkspacePath(path).toLowerCase()
      ) {
        dismissUnavailableWorkspace();
      }
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Failed to remove workspace.",
      );
    } finally {
      setRemovingPath(null);
    }
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

  const handlePickWorkspace = async () => {
    setIsPickingPath(true);
    setError(null);
    try {
      const selectedPath = await pickWorkspaceDirectory();
      if (selectedPath) {
        setPathInput(selectedPath);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to open workspace picker.",
      );
    } finally {
      setIsPickingPath(false);
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
          {unavailableWorkspace ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs">
              <p className="text-amber-200">
                Previously selected workspace is unavailable:
              </p>
              <p className="mt-1 truncate text-amber-100">
                {unavailableWorkspace}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className="rounded-full border border-amber-300/40 px-3 py-1 text-[0.65rem] text-amber-100 hover:border-amber-200"
                  onClick={() => {
                    removeStoredWorkspace(unavailableWorkspace);
                    dismissUnavailableWorkspace();
                  }}
                >
                  Remove stale reference
                </button>
                <button
                  className="rounded-full border border-white/10 px-3 py-1 text-[0.65rem] text-ink-200 hover:border-flare-300"
                  onClick={dismissUnavailableWorkspace}
                >
                  Keep and choose another
                </button>
              </div>
            </div>
          ) : null}
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
              Existing workspaces
            </p>
            <div className="mt-2 grid gap-2">
              {sortedWorkspaces.length ? (
                sortedWorkspaces.map((workspace) => {
                  const isSelected =
                    normalizedSelectedWorkspace ===
                    normalizeWorkspacePath(workspace.path).toLowerCase();
                  return (
                    <div
                      key={workspace.path}
                      className={`flex items-center gap-2 rounded-xl border bg-black/20 px-2 py-2 text-sm text-ink-100 transition hover:border-flare-300 ${
                        isSelected ? "border-flare-300/70" : "border-white/10"
                      }`}
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center justify-between rounded-lg px-2 py-1 text-left"
                        onClick={() => {
                          setSelectedWorkspace(workspace.path);
                          setWorkspacePickerOpen(false);
                        }}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="truncate">{workspace.name}</span>
                          {isSelected ? (
                            <Check className="h-4 w-4 text-emerald-300" />
                          ) : null}
                        </div>
                        <span className="ml-3 truncate text-xs text-ink-500">
                          {workspace.path}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-white/10 p-1 text-ink-400 hover:border-rose-300 hover:text-rose-200 disabled:opacity-50"
                        onClick={() => {
                          void handleRemoveWorkspace(workspace.path);
                        }}
                        disabled={removingPath === workspace.path}
                        aria-label={`Remove ${workspace.name}`}
                        title={`Remove ${workspace.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-xs text-ink-500">
                    No workspaces configured yet.
                  </p>
                  <button
                    className="rounded-full border border-white/10 px-3 py-1 text-[0.65rem] text-ink-300 hover:border-flare-300 hover:text-ink-100"
                    onClick={handleClose}
                  >
                    Skip for now
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
              Add a workspace
            </p>
            <div className="flex items-center gap-2">
              <input
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-ink-100"
                placeholder="C:\\Repos\\my-project"
                value={pathInput}
                onChange={(event) => setPathInput(event.target.value)}
              />
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-2 text-xs text-ink-200 hover:border-flare-300 disabled:opacity-60"
                onClick={() => {
                  void handlePickWorkspace();
                }}
                disabled={isSaving || isPickingPath}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                {isPickingPath ? "Opening…" : "Browse"}
              </button>
            </div>
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
