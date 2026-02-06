import {
  ChevronDown,
  Cloud,
  FileCode2,
  ListChecks,
  ShieldAlert,
} from "lucide-react";

import { WorkspacePickerDropdown } from "@/app/components/workspaces/WorkspacePickerDropdown";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import { workspaceNameFromPath } from "@/app/utils/workspace";

interface ThreadEmptyStateProps {
  onSelectPrompt: (prompt: string) => void;
}

const starterPrompts = [
  {
    id: "game",
    label: "Create a classic snake game",
    Icon: FileCode2,
  },
  {
    id: "bugfix",
    label: "Find and fix bugs in my code",
    Icon: ShieldAlert,
  },
  {
    id: "summary",
    label: "Summarize this app in a PDF",
    Icon: ListChecks,
  },
];

export function ThreadEmptyState({ onSelectPrompt }: ThreadEmptyStateProps) {
  const { workspaces } = useWorkspaces();
  const { selectedWorkspace } = useWorkspaceUi();
  const resolvedWorkspace =
    selectedWorkspace ?? workspaces[0]?.path ?? "Add workspace";
  const label = resolvedWorkspace
    ? workspaceNameFromPath(resolvedWorkspace)
    : "Add workspace";
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/10 text-ink-200">
        <Cloud className="h-6 w-6" />
      </div>
      <h2 className="mt-6 font-display text-5xl font-semibold text-ink-50">
        Let&apos;s build
      </h2>
      <div className="mt-4">
        <WorkspacePickerDropdown
          align="left"
          trigger={({ toggle }) => (
            <button
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-ink-300 transition hover:bg-white/5 hover:text-ink-100"
              onClick={toggle}
            >
              {label}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}
        />
      </div>
      <div className="mt-8 grid w-full gap-3 text-left text-sm md:grid-cols-3">
        {starterPrompts.map((prompt) => (
          <button
            key={prompt.id}
            className="group flex h-28 flex-col justify-between rounded-2xl border border-white/10 bg-black/20 p-4 text-ink-200 transition hover:border-flare-300 hover:bg-black/30 hover:text-ink-50"
            onClick={() => onSelectPrompt(prompt.label)}
          >
            <div className="flex justify-end">
              <prompt.Icon className="h-4 w-4 text-ink-400 transition group-hover:text-ink-200" />
            </div>
            <span className="leading-relaxed">{prompt.label}</span>
          </button>
        ))}
      </div>
      <button className="mt-6 text-xs uppercase tracking-[0.3em] text-ink-400 transition hover:text-ink-200">
        Explore more
      </button>
    </div>
  );
}
