import { ChevronDown, Ghost } from "lucide-react";

import { WorkspacePickerDropdown } from "@/app/components/workspaces/WorkspacePickerDropdown";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import { workspaceNameFromPath } from "@/app/utils/workspace";

export function ThreadEmptyState() {
  const { workspaces } = useWorkspaces();
  const { selectedWorkspace } = useWorkspaceUi();
  const resolvedWorkspace = selectedWorkspace ?? workspaces[0]?.path;
  const label = resolvedWorkspace
    ? workspaceNameFromPath(resolvedWorkspace)
    : "Pick a workspace";

  return (
    <div className="relative min-h-[62vh] overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-b from-black/10 via-black/5 to-transparent">
      <div className="pointer-events-none absolute -right-20 top-8 h-56 w-56 rounded-full bg-flare-300/5 blur-3xl" />
      <div className="pointer-events-none absolute right-24 top-20 h-32 w-32 rounded-full border border-white/10 bg-black/20 backdrop-blur-sm">
        <Ghost className="mx-auto mt-8 h-16 w-16 text-ink-300/80" />
      </div>
      <div className="absolute bottom-8 right-6 sm:bottom-12 sm:right-10">
        <h2 className="font-display text-4xl font-semibold tracking-tight text-ink-50 sm:text-6xl">
          Let&apos;s build
        </h2>
        <div className="mt-3">
          <WorkspacePickerDropdown
            align="right"
            trigger={({ toggle }) => (
              <button
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs uppercase tracking-[0.2em] text-ink-300 transition hover:border-flare-300 hover:text-ink-100"
                onClick={toggle}
              >
                {label}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            )}
          />
        </div>
      </div>
    </div>
  );
}
