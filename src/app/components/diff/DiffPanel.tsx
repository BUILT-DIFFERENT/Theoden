import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMatchRoute } from "@tanstack/react-router";
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  MoreHorizontal,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { diffStatsFromText } from "@/app/services/cli/diffSummary";
import { useThreadDiffText } from "@/app/services/cli/useThreadDiff";
import {
  revertAllPaths,
  revertPath,
  stageAllPaths,
  stagePath,
  unstagePath,
} from "@/app/services/git/changes";
import { getGitWorkspaceStatus } from "@/app/services/git/status";
import { mockThreadDetail } from "@/app/state/mockData";
import { useThreadUi } from "@/app/state/threadUi";
import type { DiffSummary, ThreadDetail } from "@/app/types";
import { isTauri } from "@/app/utils/tauri";

interface DiffSection {
  path: string;
  additions: number;
  deletions: number;
  lines: string[];
}

interface DiffLineEntry {
  line: string;
  lineNumber: number;
}

type DiffRenderableChunk =
  | { kind: "line"; entry: DiffLineEntry }
  | { kind: "context"; startLineNumber: number; lines: DiffLineEntry[] };

const COLLAPSIBLE_CONTEXT_MIN_LINES = 4;

function isContextLine(line: string) {
  return line.startsWith(" ");
}

function toRenderableChunks(lines: string[]): DiffRenderableChunk[] {
  const chunks: DiffRenderableChunk[] = [];
  let contextBuffer: DiffLineEntry[] = [];

  const flushContextBuffer = () => {
    if (!contextBuffer.length) {
      return;
    }
    if (contextBuffer.length >= COLLAPSIBLE_CONTEXT_MIN_LINES) {
      chunks.push({
        kind: "context",
        startLineNumber: contextBuffer[0].lineNumber,
        lines: contextBuffer,
      });
    } else {
      contextBuffer.forEach((entry) => chunks.push({ kind: "line", entry }));
    }
    contextBuffer = [];
  };

  lines.forEach((line, index) => {
    const entry = { line, lineNumber: index + 1 };
    if (isContextLine(line)) {
      contextBuffer.push(entry);
      return;
    }
    flushContextBuffer();
    chunks.push({ kind: "line", entry });
  });

  flushContextBuffer();
  return chunks;
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
  const queryClient = useQueryClient();
  const matchRoute = useMatchRoute();
  const threadMatch = matchRoute({ to: "/t/$threadId" });
  const threadId = threadMatch ? threadMatch.threadId : undefined;
  const detail = thread ?? mockThreadDetail;
  const workspacePath = detail.subtitle;
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
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<{
    path: string;
    lineNumber: number;
    content: string;
  } | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [hunkActionFeedback, setHunkActionFeedback] = useState<string | null>(
    null,
  );
  const [hunkActionError, setHunkActionError] = useState<string | null>(null);
  const [expandedContextBlocks, setExpandedContextBlocks] = useState<
    Record<string, boolean>
  >({});
  const [annotations, setAnnotations] = useState<
    Array<{
      id: string;
      path: string;
      lineNumber: number;
      content: string;
      comment: string;
      createdAt: number;
    }>
  >([]);
  const gitStatus = useQuery({
    queryKey: ["git", "status", workspacePath],
    queryFn: () => getGitWorkspaceStatus(workspacePath),
    enabled: isTauri() && Boolean(workspacePath),
    refetchInterval: isTauri() ? 5000 : false,
  });

  const sections = useMemo(
    () => parseDiffSections(liveDiffText, summary),
    [liveDiffText, summary],
  );
  const sectionMap = useMemo(
    () =>
      new Map(
        sections.map(
          (section) => [section.path, section] satisfies [string, DiffSection],
        ),
      ),
    [sections],
  );
  const summaryFileMap = useMemo(
    () => new Map(summary.files.map((file) => [file.path, file])),
    [summary.files],
  );

  const statusPaths = useMemo(() => {
    if (gitStatus.data) {
      return {
        staged: gitStatus.data.stagedPaths,
        unstaged: gitStatus.data.unstagedPaths,
      };
    }
    return {
      staged: [] as string[],
      unstaged: sections.map((section) => section.path),
    };
  }, [gitStatus.data, sections]);

  const stagedSections = useMemo(
    () =>
      statusPaths.staged.map((path) => {
        const knownSection = sectionMap.get(path);
        if (knownSection) return knownSection;
        const file = summaryFileMap.get(path);
        return {
          path,
          additions: file?.additions ?? 0,
          deletions: file?.deletions ?? 0,
          lines: [],
        };
      }),
    [sectionMap, statusPaths.staged, summaryFileMap],
  );
  const unstagedSections = useMemo(
    () =>
      statusPaths.unstaged.map((path) => {
        const knownSection = sectionMap.get(path);
        if (knownSection) return knownSection;
        const file = summaryFileMap.get(path);
        return {
          path,
          additions: file?.additions ?? 0,
          deletions: file?.deletions ?? 0,
          lines: [],
        };
      }),
    [sectionMap, statusPaths.unstaged, summaryFileMap],
  );
  const activeSections =
    activeTab === "staged" ? stagedSections : unstagedSections;
  const selectedSection = useMemo(() => {
    if (!activeSections.length) {
      return null;
    }
    if (!selectedPath) {
      return activeSections[0] ?? null;
    }
    return (
      activeSections.find((section) => section.path === selectedPath) ??
      activeSections[0] ??
      null
    );
  }, [activeSections, selectedPath]);
  const selectedSectionChunks = useMemo(
    () => (selectedSection ? toRenderableChunks(selectedSection.lines) : []),
    [selectedSection],
  );
  const collapsedContextLineCount = useMemo(() => {
    if (!selectedSection) {
      return 0;
    }
    return selectedSectionChunks.reduce((count, chunk) => {
      if (chunk.kind !== "context") {
        return count;
      }
      const contextKey = `${selectedSection.path}:${chunk.startLineNumber}`;
      return expandedContextBlocks[contextKey]
        ? count
        : count + chunk.lines.length;
    }, 0);
  }, [expandedContextBlocks, selectedSection, selectedSectionChunks]);

  const stagedCount = stagedSections.length;
  const unstagedCount = unstagedSections.length;
  const canRunGitActions = isTauri() && Boolean(workspacePath);
  const hunkActionMutation = useMutation({
    mutationFn: async (action: {
      kind: "stage" | "unstage" | "revert" | "stage_all" | "revert_all";
      path?: string;
      includeStaged?: boolean;
    }) => {
      if (!workspacePath) {
        throw new Error("No workspace available for diff actions.");
      }
      if (action.kind === "stage_all") {
        await stageAllPaths(workspacePath);
        return;
      }
      if (action.kind === "revert_all") {
        await revertAllPaths(workspacePath, action.includeStaged ?? false);
        return;
      }
      if (!action.path) {
        throw new Error("No file path available for this diff action.");
      }
      if (action.kind === "stage") {
        await stagePath(workspacePath, action.path);
        return;
      }
      if (action.kind === "unstage") {
        await unstagePath(workspacePath, action.path);
        return;
      }
      await revertPath(
        workspacePath,
        action.path,
        action.includeStaged ?? false,
      );
    },
    onSuccess: async (_, action) => {
      await queryClient.invalidateQueries({
        queryKey: ["git", "status", workspacePath],
      });
      setHunkActionError(null);
      if (action.kind === "stage_all") {
        setHunkActionFeedback("Staged all changes.");
        return;
      }
      if (action.kind === "revert_all") {
        setHunkActionFeedback(
          action.includeStaged
            ? "Reverted all staged and unstaged changes."
            : "Reverted all unstaged changes.",
        );
        return;
      }
      if (action.kind === "stage" && action.path) {
        setHunkActionFeedback(`Staged ${action.path}`);
        return;
      }
      if (action.kind === "unstage" && action.path) {
        setHunkActionFeedback(`Unstaged ${action.path}`);
        return;
      }
      setHunkActionFeedback(`Reverted ${action.path ?? "file"}`);
    },
    onError: (error) => {
      setHunkActionFeedback(null);
      setHunkActionError(
        error instanceof Error ? error.message : "Hunk action failed.",
      );
    },
  });

  useEffect(() => {
    if (!activeSections.length) {
      setSelectedPath(null);
      setSelectedLine(null);
      return;
    }
    if (
      selectedPath &&
      activeSections.some((section) => section.path === selectedPath)
    ) {
      return;
    }
    setSelectedPath(activeSections[0]?.path ?? null);
  }, [activeSections, selectedPath]);

  useEffect(() => {
    if (!selectedLine) {
      return;
    }
    if (selectedSection?.path === selectedLine.path) {
      return;
    }
    setSelectedLine(null);
  }, [selectedLine, selectedSection?.path]);

  useEffect(() => {
    setExpandedContextBlocks({});
  }, [selectedSection?.path]);

  useEffect(() => {
    if (!hunkActionFeedback) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setHunkActionFeedback(null);
    }, 2000);
    return () => window.clearTimeout(timeoutId);
  }, [hunkActionFeedback]);

  const runHunkAction = async (action: "stage" | "unstage" | "revert") => {
    if (!selectedSection) {
      return;
    }
    if (!canRunGitActions) {
      setHunkActionFeedback(null);
      setHunkActionError("Hunk actions are available in the desktop app.");
      return;
    }
    setHunkActionError(null);
    try {
      await hunkActionMutation.mutateAsync({
        kind: action,
        path: selectedSection.path,
        includeStaged: action === "revert" && activeTab === "staged",
      });
    } catch {
      // Error state is already handled by the mutation onError callback.
    }
  };

  const runGlobalAction = async (action: "stage_all" | "revert_all") => {
    if (!canRunGitActions) {
      setHunkActionFeedback(null);
      setHunkActionError("Git actions are available in the desktop app.");
      return;
    }
    setHunkActionError(null);
    try {
      await hunkActionMutation.mutateAsync({
        kind: action,
        includeStaged: action === "revert_all" && activeTab === "staged",
      });
    } catch {
      // Error state is already handled by the mutation onError callback.
    }
  };

  const submitAnnotation = () => {
    const comment = commentDraft.trim();
    if (!selectedLine || !comment) {
      return;
    }
    const annotation = {
      id: `annotation-${Date.now()}`,
      path: selectedLine.path,
      lineNumber: selectedLine.lineNumber,
      content: selectedLine.content,
      comment,
      createdAt: Date.now(),
    };
    setAnnotations((current) => [...current, annotation]);
    try {
      window.dispatchEvent(
        new CustomEvent("theoden:diff-annotation", {
          detail: annotation,
        }),
      );
    } catch (error) {
      console.warn("Failed to dispatch diff annotation event", error);
    }
    setCommentDraft("");
    setSelectedLine(null);
  };

  const renderDiffLine = (
    path: string,
    entry: DiffLineEntry,
    fallbackColorClass = "text-ink-300 border-transparent",
  ) => {
    const line = entry.line;
    const isAdd = line.startsWith("+") && !line.startsWith("+++");
    const isRemove = line.startsWith("-") && !line.startsWith("---");
    const isSelectedLine =
      selectedLine?.path === path &&
      selectedLine.lineNumber === entry.lineNumber;
    const colorClass = isSelectedLine
      ? "text-ink-100 bg-flare-500/10 border-flare-400"
      : isAdd
        ? "text-emerald-300 bg-emerald-500/5 border-emerald-500/40"
        : isRemove
          ? "text-rose-300 bg-rose-500/5 border-rose-500/40"
          : fallbackColorClass;
    return (
      <button
        key={`${path}-${entry.lineNumber}`}
        type="button"
        className={`grid w-full grid-cols-[36px_1fr] items-start gap-2 border-l-2 px-3 py-1 text-left ${colorClass}`}
        onClick={() => {
          setSelectedLine({
            path,
            lineNumber: entry.lineNumber,
            content: line,
          });
          setCommentDraft("");
        }}
      >
        <span className="text-[0.6rem] text-ink-500">{entry.lineNumber}</span>
        <span className="whitespace-pre-wrap">{line || " "}</span>
      </button>
    );
  };

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
          {activeSections.length ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">
              <p className="px-2 pb-1 text-[0.65rem] uppercase tracking-[0.2em] text-ink-500">
                Files
              </p>
              <div className="max-h-36 space-y-1 overflow-auto">
                {activeSections.map((section) => {
                  const isSelected = selectedSection?.path === section.path;
                  return (
                    <button
                      key={section.path}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${
                        isSelected
                          ? "border border-flare-300 bg-flare-400/10 text-ink-50"
                          : "border border-transparent text-ink-200 hover:border-white/10 hover:bg-white/5"
                      }`}
                      onClick={() => setSelectedPath(section.path)}
                    >
                      <span className="truncate">{section.path}</span>
                      <span className="text-[0.65rem] text-ink-500">
                        +{section.additions} -{section.deletions}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {selectedSection ? (
            <div
              key={selectedSection.path}
              className="rounded-xl border border-white/10 bg-black/20"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs">
                <span className="text-ink-100">{selectedSection.path}</span>
                <span className="text-ink-400">
                  +{selectedSection.additions} -{selectedSection.deletions}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[0.65rem] text-ink-500">
                <span>
                  {collapsedContextLineCount > 0
                    ? `${collapsedContextLineCount} unmodified lines collapsed`
                    : "All unmodified lines shown"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-white/10 p-1 hover:border-flare-300 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => {
                      void runHunkAction("revert");
                    }}
                    disabled={hunkActionMutation.isPending || !selectedSection}
                    title={
                      activeTab === "staged"
                        ? "Revert staged + working tree changes for this file"
                        : "Revert working tree changes for this file"
                    }
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                  <button
                    className="rounded-full border border-white/10 p-1 hover:border-flare-300 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => {
                      void runHunkAction(
                        activeTab === "staged" ? "unstage" : "stage",
                      );
                    }}
                    disabled={hunkActionMutation.isPending || !selectedSection}
                    title={
                      activeTab === "staged"
                        ? "Unstage this file"
                        : "Stage this file"
                    }
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
              {selectedSectionChunks.length ? (
                <div className="divide-y divide-white/5 font-mono text-[0.65rem]">
                  {selectedSectionChunks.map((chunk) => {
                    if (chunk.kind === "line") {
                      return renderDiffLine(selectedSection.path, chunk.entry);
                    }

                    const contextKey = `${selectedSection.path}:${chunk.startLineNumber}`;
                    const isExpanded =
                      expandedContextBlocks[contextKey] ?? false;
                    if (!isExpanded) {
                      return (
                        <button
                          key={contextKey}
                          type="button"
                          className="flex w-full items-center justify-between border-l-2 border-transparent px-3 py-1 text-left text-ink-500 hover:bg-white/5"
                          onClick={() =>
                            setExpandedContextBlocks((current) => ({
                              ...current,
                              [contextKey]: true,
                            }))
                          }
                        >
                          <span>{chunk.lines.length} unmodified lines</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      );
                    }

                    return (
                      <div key={contextKey}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between border-l-2 border-transparent px-3 py-1 text-left text-ink-500 hover:bg-white/5"
                          onClick={() =>
                            setExpandedContextBlocks((current) => ({
                              ...current,
                              [contextKey]: false,
                            }))
                          }
                        >
                          <span>
                            Hide {chunk.lines.length} unmodified lines
                          </span>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        {chunk.lines.map((entry) =>
                          renderDiffLine(
                            selectedSection.path,
                            entry,
                            "text-ink-400 border-transparent bg-black/20",
                          ),
                        )}
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
          ) : null}
          {!activeSections.length ? (
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-xs text-ink-500">
              {activeTab === "staged"
                ? "No staged files."
                : "No unstaged files."}
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs text-ink-400">Request change</p>
          {selectedLine ? (
            <>
              <p className="mt-2 text-[0.65rem] text-ink-500">
                {selectedLine.path}:{selectedLine.lineNumber}
              </p>
              <textarea
                className="mt-2 h-20 w-full resize-none rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-ink-100 focus:outline-none"
                placeholder="Request change"
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
              />
              <div className="mt-3 flex justify-end gap-2 text-xs">
                <button
                  className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
                  onClick={() => {
                    setSelectedLine(null);
                    setCommentDraft("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-ink-50 hover:bg-flare-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={submitAnnotation}
                  disabled={!commentDraft.trim()}
                >
                  Comment
                </button>
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs text-ink-500">
              Click a diff line to request a targeted change.
            </p>
          )}
          {annotations.length ? (
            <p className="mt-2 text-[0.65rem] text-ink-500">
              {annotations.length} change request
              {annotations.length === 1 ? "" : "s"} logged this session.
            </p>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <button
            className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              void runGlobalAction("revert_all");
            }}
            disabled={hunkActionMutation.isPending || !canRunGitActions}
          >
            Revert all
          </button>
          <div className="flex items-center gap-2">
            <button
              className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
              onClick={() => setActiveModal("commit")}
            >
              Commit
            </button>
            <button
              className="rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-ink-50 hover:bg-flare-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                void runGlobalAction("stage_all");
              }}
              disabled={hunkActionMutation.isPending || !canRunGitActions}
            >
              Stage all
            </button>
          </div>
        </div>
        {hunkActionFeedback ? (
          <p className="mt-2 text-[0.65rem] text-emerald-300">
            {hunkActionFeedback}
          </p>
        ) : null}
        {hunkActionError ? (
          <p className="mt-2 text-[0.65rem] text-rose-300">{hunkActionError}</p>
        ) : null}
      </div>
    </div>
  );
}
