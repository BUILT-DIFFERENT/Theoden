import { useMatchRoute } from "@tanstack/react-router";
import {
  ChevronDown,
  FolderOpen,
  MoreHorizontal,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { diffStatsFromText } from "@/app/services/cli/diffSummary";
import { useThreadDiffText } from "@/app/services/cli/useThreadDiff";
import { mockThreadDetail } from "@/app/state/mockData";
import { useThreadUi } from "@/app/state/threadUi";
import type { DiffSummary, ThreadDetail } from "@/app/types";

interface DiffSection {
  path: string;
  additions: number;
  deletions: number;
  lines: string[];
}

function parseDiffSections(
  diffText: string,
  summary: DiffSummary,
): DiffSection[] {
  if (!diffText.trim()) {
    return summary.files.map((file) => ({
      path: file.path,
      additions: file.additions,
      deletions: file.deletions,
      lines: [],
    }));
  }

  const sections: DiffSection[] = [];
  let current: DiffSection | null = null;

  diffText.split(/\r?\n/).forEach((line) => {
    if (line.startsWith("diff --git")) {
      if (current) {
        sections.push(current);
      }
      const match = line.match(/diff --git a\/(.+) b\//);
      current = {
        path: match?.[1] ?? "unknown",
        additions: 0,
        deletions: 0,
        lines: [],
      };
      return;
    }
    if (!current) {
      return;
    }
    if (line.startsWith("+++ b/")) {
      current.path = line.replace("+++ b/", "");
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      current.additions += 1;
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      current.deletions += 1;
    }
    current.lines.push(line);
  });

  if (current) {
    sections.push(current);
  }

  return sections;
}

interface DiffPanelProps {
  thread?: ThreadDetail;
}

export function DiffPanel({ thread }: DiffPanelProps) {
  const { setActiveModal, setReviewOpen } = useThreadUi();
  const matchRoute = useMatchRoute();
  const threadMatch = matchRoute({ to: "/threads/$threadId" });
  const threadId = threadMatch ? threadMatch.threadId : undefined;
  const detail = thread ?? mockThreadDetail;
  const diffText = detail.diffText ?? "";
  const liveDiffText = useThreadDiffText(threadId, diffText);
  const hasLiveDiff = liveDiffText.trim().length > 0;
  const diffStats = hasLiveDiff
    ? diffStatsFromText(liveDiffText)
    : {
        additions: detail.diffSummary.additions,
        deletions: detail.diffSummary.deletions,
      };
  const summary = useMemo(
    () => ({
      ...detail.diffSummary,
      additions: diffStats.additions,
      deletions: diffStats.deletions,
    }),
    [detail.diffSummary, diffStats.additions, diffStats.deletions],
  );
  const [activeTab, setActiveTab] = useState<"unstaged" | "staged">("unstaged");

  const sections = useMemo(
    () => parseDiffSections(liveDiffText, summary),
    [liveDiffText, summary],
  );

  const stagedCount = Math.max(0, summary.filesChanged - 1);
  const unstagedCount = summary.filesChanged;

  return (
    <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-hidden rounded-2xl border border-white/10 bg-ink-900/70 shadow-card">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <button className="flex items-center gap-1 text-sm text-ink-100">
            Uncommitted changes
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <div className="mt-2 flex items-center gap-2 text-[0.65rem] text-ink-400">
            <button
              className={`rounded-full border px-2 py-0.5 ${
                activeTab === "unstaged"
                  ? "border-flare-300 text-ink-50"
                  : "border-white/10 text-ink-400"
              }`}
              onClick={() => setActiveTab("unstaged")}
            >
              Unstaged · {unstagedCount}
            </button>
            <button
              className={`rounded-full border px-2 py-0.5 ${
                activeTab === "staged"
                  ? "border-flare-300 text-ink-50"
                  : "border-white/10 text-ink-400"
              }`}
              onClick={() => setActiveTab("staged")}
            >
              Staged · {stagedCount}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-ink-400">
          <button className="rounded-full border border-white/10 p-1 hover:border-flare-300">
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
          <button className="rounded-full border border-white/10 p-1 hover:border-flare-300">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          <button
            className="rounded-full border border-white/10 p-1 hover:border-flare-300"
            onClick={() => setReviewOpen(false)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="max-h-[65vh] overflow-auto px-4 py-4">
        <div className="space-y-4">
          {sections.map((section) => (
            <div
              key={section.path}
              className="rounded-xl border border-white/10 bg-black/20"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs">
                <span className="text-ink-100">{section.path}</span>
                <span className="text-ink-400">
                  +{section.additions} -{section.deletions}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[0.65rem] text-ink-500">
                <span>99 unmodified lines</span>
                <div className="flex items-center gap-2">
                  <button className="rounded-full border border-white/10 p-1 hover:border-flare-300">
                    <RotateCcw className="h-3 w-3" />
                  </button>
                  <button className="rounded-full border border-white/10 p-1 hover:border-flare-300">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
              {section.lines.length ? (
                <div className="divide-y divide-white/5 font-mono text-[0.65rem]">
                  {section.lines.map((line, index) => {
                    const isAdd =
                      line.startsWith("+") && !line.startsWith("+++");
                    const isRemove =
                      line.startsWith("-") && !line.startsWith("---");
                    const colorClass = isAdd
                      ? "text-emerald-300 bg-emerald-500/5 border-emerald-500/40"
                      : isRemove
                        ? "text-rose-300 bg-rose-500/5 border-rose-500/40"
                        : "text-ink-300 border-transparent";
                    return (
                      <div
                        key={`${section.path}-${index}`}
                        className={`grid grid-cols-[36px_1fr] items-start gap-2 border-l-2 px-3 py-1 ${colorClass}`}
                      >
                        <span className="text-[0.6rem] text-ink-500">
                          {index + 1}
                        </span>
                        <span className="whitespace-pre-wrap">
                          {line || " "}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-3 text-xs text-ink-500">
                  Diff preview pending.
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs text-ink-400">Request change</p>
          <textarea
            className="mt-2 h-20 w-full resize-none rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-ink-100 focus:outline-none"
            placeholder="Request change"
          />
          <div className="mt-3 flex justify-end gap-2 text-xs">
            <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">
              Cancel
            </button>
            <button className="rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-ink-50 hover:bg-flare-400/20">
              Comment
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">
            Revert all
          </button>
          <div className="flex items-center gap-2">
            <button
              className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
              onClick={() => setActiveModal("commit")}
            >
              Commit
            </button>
            <button className="rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-ink-50 hover:bg-flare-400/20">
              Stage all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
