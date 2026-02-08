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
    <div className="relative min-h-[58vh] overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_10%_28%,rgba(255,122,26,0.07),transparent_45%),radial-gradient(circle_at_84%_22%,rgba(95,150,255,0.2),transparent_42%),linear-gradient(110deg,rgba(8,10,17,0.92),rgba(6,20,44,0.85)_64%,rgba(10,30,62,0.9))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className="pointer-events-none absolute -right-20 top-8 h-56 w-56 rounded-full bg-[#3f7de8]/16 blur-3xl" />
      <div className="pointer-events-none absolute right-24 top-16 h-36 w-36 rounded-full border border-white/10 bg-black/28 backdrop-blur-sm">
        <Ghost className="mx-auto mt-10 h-16 w-16 text-ink-300/80" />
      </div>
      <div className="absolute bottom-9 right-6 sm:bottom-12 sm:right-10">
        <h2 className="font-display text-4xl font-semibold tracking-tight text-ink-50 sm:text-7xl">
          Let&apos;s build
        </h2>
        <div className="mt-3">
          <WorkspacePickerDropdown
            align="right"
            trigger={({ toggle }) => (
              <button
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#071327]/75 px-4 py-2 text-xs uppercase tracking-[0.2em] text-ink-300 transition hover:border-flare-300 hover:text-ink-100"
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
