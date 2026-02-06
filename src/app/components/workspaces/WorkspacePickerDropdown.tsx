import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Folder, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { setWorkspaceTrustLevel } from "@/app/services/cli/workspaces";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import { normalizeWorkspacePath } from "@/app/utils/workspace";

interface WorkspacePickerDropdownProps {
  align?: "left" | "right";
  trigger: (props: { isOpen: boolean; toggle: () => void }) => ReactNode;
}

export function WorkspacePickerDropdown({
  align = "left",
  trigger,
}: WorkspacePickerDropdownProps) {
  const queryClient = useQueryClient();
  const { workspaces } = useWorkspaces();
  const { selectedWorkspace, setSelectedWorkspace, setWorkspacePickerOpen } =
    useWorkspaceUi();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trustMutation = useMutation({
    mutationFn: async (payload: {
      path: string;
      trustLevel: "trusted" | "untrusted";
    }) => setWorkspaceTrustLevel(payload.path, payload.trustLevel),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  const sortedWorkspaces = useMemo(
    () => workspaces.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [workspaces],
  );
  const normalizedSelectedWorkspace = selectedWorkspace
    ? normalizeWorkspacePath(selectedWorkspace).toLowerCase()
    : null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      {trigger({ isOpen, toggle: () => setIsOpen((open) => !open) })}
      {isOpen ? (
        <div
          className={`surface-panel absolute z-30 mt-2 w-80 p-2 text-xs text-ink-200 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <p className="px-3 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-ink-500">
            Select your workspace
          </p>
          <div className="codex-scrollbar max-h-64 space-y-1 overflow-auto">
            {sortedWorkspaces.length ? (
              sortedWorkspaces.map((workspace) => {
                const normalizedPath = normalizeWorkspacePath(
                  workspace.path,
                ).toLowerCase();
                const isSelected =
                  normalizedPath === normalizedSelectedWorkspace;
                return (
                  <div
                    key={workspace.path}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-2 py-2 transition ${
                      isSelected
                        ? "border-flare-300 bg-flare-400/10"
                        : "border-transparent hover:border-white/10 hover:bg-white/5"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left text-ink-200"
                      onClick={() => {
                        setSelectedWorkspace(workspace.path);
                        setIsOpen(false);
                      }}
                    >
                      <Folder className="h-3.5 w-3.5 text-ink-400" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm text-ink-100">
                            {workspace.name}
                          </p>
                          <span
                            className={`rounded-full border px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.08em] ${
                              workspace.trustLevel === "untrusted"
                                ? "border-amber-300/40 text-amber-200"
                                : "border-emerald-300/40 text-emerald-200"
                            }`}
                          >
                            {workspace.trustLevel === "untrusted"
                              ? "untrusted"
                              : "trusted"}
                          </span>
                        </div>
                        <p className="truncate text-[0.65rem] text-ink-500">
                          {workspace.path}
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-white/10 px-2 py-0.5 text-[0.55rem] text-ink-300 hover:border-flare-300"
                        onClick={() => {
                          void trustMutation.mutateAsync({
                            path: workspace.path,
                            trustLevel:
                              workspace.trustLevel === "untrusted"
                                ? "trusted"
                                : "untrusted",
                          });
                        }}
                        disabled={trustMutation.isPending}
                      >
                        {workspace.trustLevel === "untrusted"
                          ? "Trust"
                          : "Untrust"}
                      </button>
                      {isSelected ? (
                        <Check className="h-4 w-4 text-emerald-300" />
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[0.7rem] text-ink-500">
                No workspaces configured yet.
              </p>
            )}
          </div>
          <button
            className="mt-2 flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-ink-200 transition hover:border-flare-300 hover:bg-black/30"
            onClick={() => {
              setIsOpen(false);
              setWorkspacePickerOpen(true);
            }}
          >
            <div className="flex items-center gap-2">
              <Plus className="h-3.5 w-3.5" />
              <span>Add new workspace</span>
            </div>
            <ChevronDown className="h-3 w-3 -rotate-90 text-ink-500" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
