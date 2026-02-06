import { Cloud, ChevronDown } from "lucide-react";

interface ThreadEmptyStateProps {
  workspaceName: string;
  onSelectPrompt: (prompt: string) => void;
}

const starterPrompts = [
  "Create a classic snake game",
  "Find and fix a bugs in my code",
  "Summarize this app in a $pdf",
];

export function ThreadEmptyState({
  workspaceName,
  onSelectPrompt,
}: ThreadEmptyStateProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-6 text-center shadow-card">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-ink-200">
        <Cloud className="h-6 w-6" />
      </div>
      <h2 className="mt-4 font-display text-2xl text-ink-50">
        Let&apos;s build
      </h2>
      <button className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-ink-300 hover:border-flare-300">
        {workspaceName}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {starterPrompts.map((prompt) => (
          <button
            key={prompt}
            className="rounded-2xl border border-white/10 bg-black/20 px-3 py-4 text-left text-sm text-ink-200 hover:border-flare-300"
            onClick={() => onSelectPrompt(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
      <button className="mt-4 text-xs text-ink-400 underline hover:text-ink-200">
        Explore more
      </button>
    </div>
  );
}
