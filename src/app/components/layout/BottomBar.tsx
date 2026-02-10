import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, GitBranch, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { WorkspacePickerDropdown } from "@/app/components/workspaces/WorkspacePickerDropdown";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { useWorkspaceBranches } from "@/app/services/git/useWorkspaceBranches";
import { useWorkspaceGitStatus } from "@/app/services/git/useWorkspaceGitStatus";
import { checkoutBranch } from "@/app/services/git/worktrees";
import {
  permissionProfileOptions,
  useCommandPermissionProfile,
} from "@/app/state/commandPolicy";
import {
  type EnvironmentMode,
  useEnvironmentUi,
} from "@/app/state/environmentUi";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import {
  resolveWorkspacePath,
  workspaceNameFromPath,
} from "@/app/utils/workspace";

const continueOptions: Array<{
  mode: EnvironmentMode;
  label: string;
  description: string;
}> = [
  {
    mode: "local",
    label: "Local",
    description: "Run directly in selected workspace.",
  },
  {
    mode: "worktree",
    label: "Worktree",
    description: "Run in an isolated branch/worktree copy.",
  },
  {
    mode: "cloud",
    label: "Cloud",
    description: "Send execution to remote cloud environment.",
  },
];

export function BottomBar() {
  const queryClient = useQueryClient();
  const { workspaces } = useWorkspaces();
  const { selectedWorkspace } = useWorkspaceUi();
  const { environmentMode, setEnvironmentMode } = useEnvironmentUi();
  const { profile: permissionProfile, setProfile: setPermissionProfile } =
    useCommandPermissionProfile();
  const [continueMenuOpen, setContinueMenuOpen] = useState(false);
  const [permissionMenuOpen, setPermissionMenuOpen] = useState(false);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);
  const continueMenuRef = useRef<HTMLDivElement | null>(null);
  const permissionMenuRef = useRef<HTMLDivElement | null>(null);
  const branchMenuRef = useRef<HTMLDivElement | null>(null);

  const resolvedWorkspace = resolveWorkspacePath({
    selectedWorkspace,
    workspaces,
  });
  const { status: gitStatus } = useWorkspaceGitStatus(resolvedWorkspace);
  const { branches } = useWorkspaceBranches(resolvedWorkspace);
  const workspaceLabel = resolvedWorkspace
    ? workspaceNameFromPath(resolvedWorkspace)
    : "Add workspace";
  const continueLabel =
    continueOptions.find((option) => option.mode === environmentMode)?.label ??
    "Local";
  const permissionLabel =
    permissionProfileOptions.find((option) => option.id === permissionProfile)
      ?.label ?? "Workspace write";
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
    if (!continueMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (continueMenuRef.current?.contains(event.target as Node)) return;
      setContinueMenuOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [continueMenuOpen]);

  useEffect(() => {
    if (!permissionMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (permissionMenuRef.current?.contains(event.target as Node)) return;
      setPermissionMenuOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [permissionMenuOpen]);

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
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#090e15]/92 px-4 py-2 text-[0.68rem] text-ink-300">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative" ref={continueMenuRef}>
          <button
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[0.68rem] text-ink-300 transition hover:border-flare-300 hover:text-ink-50"
            onClick={() => setContinueMenuOpen((open) => !open)}
          >
            Continue in {continueLabel}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {continueMenuOpen ? (
            <div className="surface-panel absolute left-0 mt-2 w-64 p-2 text-[0.7rem]">
              {continueOptions.map((option) => (
                <button
                  key={option.mode}
                  className={`w-full rounded-xl px-3 py-2 text-left ${
                    option.mode === environmentMode
                      ? "bg-flare-400/10 text-ink-50"
                      : "text-ink-200 hover:bg-white/5"
                  }`}
                  onClick={() => {
                    setEnvironmentMode(option.mode);
                    setContinueMenuOpen(false);
                  }}
                >
                  <p className="text-xs">{option.label}</p>
                  <p className="mt-0.5 text-[0.62rem] text-ink-500">
                    {option.description}
                  </p>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="relative" ref={permissionMenuRef}>
          <button
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[0.68rem] text-ink-300 transition hover:border-flare-300 hover:text-ink-50"
            onClick={() => setPermissionMenuOpen((open) => !open)}
          >
            Permissions: {permissionLabel}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {permissionMenuOpen ? (
            <div className="surface-panel absolute left-0 mt-2 w-72 p-2 text-[0.7rem]">
              {permissionProfileOptions.map((option) => (
                <button
                  key={option.id}
                  className={`w-full rounded-xl px-3 py-2 text-left ${
                    option.id === permissionProfile
                      ? "bg-flare-400/10 text-ink-50"
                      : "text-ink-200 hover:bg-white/5"
                  }`}
                  onClick={() => {
                    setPermissionProfile(option.id);
                    setPermissionMenuOpen(false);
                  }}
                >
                  <p className="text-xs">{option.label}</p>
                  <p className="mt-0.5 text-[0.62rem] text-ink-500">
                    {option.description}
                  </p>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <WorkspacePickerDropdown
          align="right"
          trigger={({ toggle }) => (
            <button
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[0.68rem] text-ink-300 transition hover:border-flare-300 hover:text-ink-50"
              onClick={toggle}
            >
              <Settings className="h-3.5 w-3.5" />
              {workspaceLabel}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}
        />
        <div className="relative" ref={branchMenuRef}>
          <button
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[0.68rem] text-ink-300 transition hover:border-flare-300 hover:text-ink-50"
            onClick={() => setBranchMenuOpen((open) => !open)}
          >
            <GitBranch className="h-3.5 w-3.5" />
            From {branchLabel}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {branchMenuOpen ? (
            <div className="surface-panel absolute right-0 mt-2 w-56 p-2 text-[0.7rem] text-ink-200">
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
