import { RotateCcw } from "lucide-react";

import type { DiffSummary } from "@/app/types";

interface FilesChangedCardProps {
  summary: DiffSummary;
}

export function FilesChangedCard({ summary }: FilesChangedCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
            Files changed
          </p>
          <p className="text-sm text-ink-200">
            {summary.filesChanged} files · +{summary.additions} / -
            {summary.deletions}
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs hover:border-flare-300">
          <RotateCcw className="h-3.5 w-3.5" />
          Undo
        </button>
      </div>
      <div className="mt-4 space-y-2 text-sm">
        {summary.files.map((file) => (
          <div
            key={file.path}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2"
          >
            <span className="text-ink-100">{file.path}</span>
            <span className="text-xs text-ink-400">
              +{file.additions} / -{file.deletions}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
