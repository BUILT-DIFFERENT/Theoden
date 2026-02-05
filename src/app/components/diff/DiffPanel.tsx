import { useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { diffStatsFromText } from "@/app/services/cli/diffSummary";
import { useThreadDetail } from "@/app/services/cli/useThreadDetail";
import { useThreadDiffText } from "@/app/services/cli/useThreadDiff";
import { mockThreadDetail } from "@/app/state/mockData";
import type { DiffSummary } from "@/app/types";

interface DiffPanelProps {
  summary?: DiffSummary;
}

export function DiffPanel({ summary }: DiffPanelProps) {
  const { threadId } = useParams({ from: "/threads/$threadId" });
  const { thread } = useThreadDetail(threadId);
  const fallbackSummary =
    summary ?? thread?.diffSummary ?? mockThreadDetail.diffSummary;
  const fallbackDiffText = thread?.diffText ?? mockThreadDetail.diffText ?? "";
  const liveDiffText = useThreadDiffText(threadId, fallbackDiffText);
  const [isOpen, setIsOpen] = useState(false);

  const resolvedSummary = useMemo(() => {
    if (!liveDiffText) return fallbackSummary;
    const diffStats = diffStatsFromText(liveDiffText);
    return {
      ...fallbackSummary,
      additions: diffStats.additions,
      deletions: diffStats.deletions,
    };
  }, [fallbackSummary, liveDiffText]);

  return (
    <div
      id="diff-panel"
      className="rounded-2xl border border-white/10 bg-ink-900/60 p-4 shadow-card"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
            Changes
          </p>
          <p className="text-sm text-ink-200">
            {resolvedSummary.filesChanged} files · +{resolvedSummary.additions}{" "}
            / -{resolvedSummary.deletions}
          </p>
        </div>
        <button
          className="rounded-full border border-white/10 px-3 py-1 text-xs hover:border-flare-300"
          onClick={() => setIsOpen((value) => !value)}
        >
          {isOpen ? "Hide diff" : "Review changes"}
        </button>
      </div>
      <div className="mt-4 space-y-3 text-sm">
        {resolvedSummary.files.map((file) => (
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
      {isOpen ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs text-ink-400">
            <span>Unified diff</span>
            <span>
              {liveDiffText ? `${liveDiffText.length} chars` : "Empty"}
            </span>
          </div>
          <div className="max-h-80 overflow-auto px-3 py-2 font-mono text-xs">
            {liveDiffText ? (
              liveDiffText.split(/\r?\n/).map((line, index) => {
                const colorClass = line.startsWith("+")
                  ? "text-emerald-300"
                  : line.startsWith("-")
                    ? "text-rose-300"
                    : "text-ink-300";
                return (
                  <div
                    key={`${index}-${line.slice(0, 20)}`}
                    className={colorClass}
                  >
                    {line || " "}
                  </div>
                );
              })
            ) : (
              <p className="text-ink-500">No diff available yet.</p>
            )}
          </div>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">
          Stage all
        </button>
        <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">
          Commit
        </button>
        <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">
          Commit &amp; PR
        </button>
      </div>
    </div>
  );
}
