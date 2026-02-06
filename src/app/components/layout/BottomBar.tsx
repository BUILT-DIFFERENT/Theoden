import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, GitBranch, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { useWorkspaceBranches } from "@/app/services/git/useWorkspaceBranches";
import { useWorkspaceGitStatus } from "@/app/services/git/useWorkspaceGitStatus";
import { checkoutBranch } from "@/app/services/git/worktrees";
import {
  type EnvironmentMode,
  useEnvironmentUi,
} from "@/app/state/environmentUi";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import { workspaceNameFromPath } from "@/app/utils/workspace";

const environmentLabels: Record<EnvironmentMode, string> = {
  local: "Local",
  worktree: "Worktree",
  cloud: "Cloud",
};

export function BottomBar() {
  const queryClient = useQueryClient();
  const { workspaces } = useWorkspaces();
  const { selectedWorkspace, setWorkspacePickerOpen } = useWorkspaceUi();
  const { environmentMode, setEnvironmentMode } = useEnvironmentUi();
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);
  const branchMenuRef = useRef<HTMLDivElement | null>(null);

  const resolvedWorkspace = selectedWorkspace ?? workspaces[0]?.path ?? null;
  const { status: gitStatus } = useWorkspaceGitStatus(resolvedWorkspace);
  const { branches } = useWorkspaceBranches(resolvedWorkspace);
  const workspaceLabel = resolvedWorkspace
    ? workspaceNameFromPath(resolvedWorkspace)
    : "Add workspace";
  const branchLabel = gitStatus?.branch ?? "main";
  const checkoutMutation = useMutation({
    mutationFn: async (branch: string) => {
      if (!resolvedWorkspace) {
        throw new Error("Select a workspace before changing branch.");
      }
      await checkoutBranch(resolvedWorkspace, branch);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["git", "status", resolvedWorkspace],
        }),
        queryClient.invalidateQueries({
          queryKey: ["git", "branches", resolvedWorkspace],
        }),
      ]);
    },
  });

  useEffect(() => {
    if (!branchMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (branchMenuRef.current?.contains(event.target as Node)) return;
      setBranchMenuOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [branchMenuOpen]);

  const handleBranchSelect = async (branch: string) => {
    setBranchError(null);
    try {
      await checkoutMutation.mutateAsync(branch);
      setBranchMenuOpen(false);
    } catch (error) {
      setBranchError(
        error instanceof Error ? error.message : "Failed to switch branch.",
      );
    }
  };

  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 bg-black/30 px-6 py-3 text-xs text-ink-300 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(environmentLabels) as EnvironmentMode[]).map((mode) => (
          <button
            key={mode}
            className={`rounded-full border px-3 py-1 text-xs transition hover:border-flare-300 ${
              environmentMode === mode
                ? "border-flare-300 bg-flare-400/10 text-ink-50"
                : "border-white/10 text-ink-300"
            }`}
            onClick={() => setEnvironmentMode(mode)}
          >
            {environmentLabels[mode]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
          onClick={() => setWorkspacePickerOpen(true)}
        >
          <Settings className="h-3.5 w-3.5" />
          {workspaceLabel}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <div className="relative" ref={branchMenuRef}>
          <button
            className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
            onClick={() => setBranchMenuOpen((open) => !open)}
          >
            <GitBranch className="h-3.5 w-3.5" />
            From {branchLabel}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {branchMenuOpen ? (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/10 bg-ink-900/95 p-2 text-[0.7rem] text-ink-200 shadow-card">
              {branches.length ? (
                branches.map((branch) => (
                  <button
                    key={branch}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-white/5 ${
                      branch === branchLabel ? "text-ink-50" : "text-ink-300"
                    }`}
                    onClick={() => {
                      void handleBranchSelect(branch);
                    }}
                    disabled={checkoutMutation.isPending}
                  >
                    <span className="truncate">{branch}</span>
                    {branch === branchLabel ? (
                      <span className="text-[0.65rem] text-emerald-300">
                        current
                      </span>
                    ) : null}
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-[0.65rem] text-ink-500">
                  No branches available.
                </p>
              )}
              {branchError ? (
                <p className="px-3 py-2 text-[0.65rem] text-rose-300">
                  {branchError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
