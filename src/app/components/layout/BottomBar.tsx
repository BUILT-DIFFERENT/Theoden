import { ChevronDown, GitBranch, Settings } from "lucide-react";
import { useState } from "react";

import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { useWorkspaceGitStatus } from "@/app/services/git/useWorkspaceGitStatus";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import { workspaceNameFromPath } from "@/app/utils/workspace";

type EnvironmentMode = "local" | "worktree" | "cloud";

const environmentLabels: Record<EnvironmentMode, string> = {
  local: "Local",
  worktree: "Worktree",
  cloud: "Cloud",
};

export function BottomBar() {
  const { workspaces } = useWorkspaces();
  const { selectedWorkspace, setWorkspacePickerOpen } = useWorkspaceUi();
  const [environmentMode, setEnvironmentMode] =
    useState<EnvironmentMode>("local");

  const resolvedWorkspace = selectedWorkspace ?? workspaces[0]?.path ?? null;
  const { status: gitStatus } = useWorkspaceGitStatus(resolvedWorkspace);
  const workspaceLabel = resolvedWorkspace
    ? workspaceNameFromPath(resolvedWorkspace)
    : "Add workspace";
  const branchLabel = gitStatus?.branch ?? "main";

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
        <button className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">
          <GitBranch className="h-3.5 w-3.5" />
          From {branchLabel}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </footer>
  );
}
