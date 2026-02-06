import { ChevronDown, Cloud, Sparkles } from "lucide-react";

import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import { workspaceNameFromPath } from "@/app/utils/workspace";

interface ThreadEmptyStateProps {
  onSelectPrompt: (prompt: string) => void;
}

const starterPrompts = [
  "Create a classic snake game",
  "Find and fix a bugs in my code",
  "Summarize this app in a $pdf",
];

export function ThreadEmptyState({ onSelectPrompt }: ThreadEmptyStateProps) {
  const { workspaces } = useWorkspaces();
  const { selectedWorkspace, setSelectedWorkspace, setWorkspacePickerOpen } =
    useWorkspaceUi();
  const resolvedWorkspace =
    selectedWorkspace ?? workspaces[0]?.path ?? "Add workspace";
  const label = resolvedWorkspace
    ? workspaceNameFromPath(resolvedWorkspace)
    : "Add workspace";
  return (
    <div className="py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/10 text-ink-200">
        <Cloud className="h-6 w-6" />
      </div>
      <h2 className="mt-6 font-display text-5xl font-semibold text-ink-50">
        Let&apos;s build
      </h2>
      <button
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-ink-300 transition hover:bg-white/5 hover:text-ink-100"
        onClick={() => {
          if (workspaces[0]?.path && !selectedWorkspace) {
            setSelectedWorkspace(workspaces[0].path);
          }
          setWorkspacePickerOpen(true);
        }}
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
        {starterPrompts.map((prompt) => (
          <button
            key={prompt}
            className="group inline-flex items-center gap-2 rounded-full px-4 py-2 text-ink-200 transition hover:bg-white/5 hover:text-ink-50"
            onClick={() => onSelectPrompt(prompt)}
          >
            <Sparkles className="h-4 w-4 text-ink-400 transition group-hover:text-ink-200" />
            <span>{prompt}</span>
          </button>
        ))}
      </div>
      <button className="mt-6 text-xs uppercase tracking-[0.3em] text-ink-400 transition hover:text-ink-200">
        Explore more
      </button>
    </div>
  );
}
