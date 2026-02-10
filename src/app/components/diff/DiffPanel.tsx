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
import { useEffect, useMemo, useRef, useState } from "react";

import { diffStatsFromText } from "@/app/services/cli/diffSummary";
import { startReview } from "@/app/services/cli/review";
import { useThreadDiffText } from "@/app/services/cli/useThreadDiff";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { openInEditor } from "@/app/services/desktop/open";
import {
  revertAllPaths,
  revertHunk,
  stageAllPaths,
  stageHunk,
  unstageHunk,
} from "@/app/services/git/changes";
import { getGitWorkspaceDiff } from "@/app/services/git/diff";
import { getGitWorkspaceStatus } from "@/app/services/git/status";
import { mockEditors } from "@/app/state/settingsData";
import {
  annotationScopeKey,
  useDiffAnnotations,
} from "@/app/state/threadAnnotations";
import { useThreadUi } from "@/app/state/threadUi";
import { useRuntimeSettings } from "@/app/state/useRuntimeSettings";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import type { DiffSummary, ThreadDetail } from "@/app/types";
import { isTauri } from "@/app/utils/tauri";
import { resolveWorkspacePath } from "@/app/utils/workspace";

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

interface DiffHunk {
  id: string;
  path: string;
  header: string;
  additions: number;
  deletions: number;
  lineStart: number;
  lines: string[];
  patch: string;
}

type DiffRenderableChunk =
  | { kind: "line"; entry: DiffLineEntry }
  | { kind: "context"; startLineNumber: number; lines: DiffLineEntry[] };

const COLLAPSIBLE_CONTEXT_MIN_LINES = 4;
const EMPTY_SUMMARY: DiffSummary = {
  filesChanged: 0,
  additions: 0,
  deletions: 0,
  files: [],
};

function isContextLine(line: string) {
  return line.startsWith(" ");
}

function toRenderableChunks(
  lines: string[],
  lineStart = 1,
): DiffRenderableChunk[] {
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
    const entry = { line, lineNumber: lineStart + index };
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

function parseDiffHunks(section: DiffSection): DiffHunk[] {
  if (!section.lines.length) {
    return [];
  }
  const firstHunkIndex = section.lines.findIndex((line) =>
    line.startsWith("@@"),
  );
  if (firstHunkIndex < 0) {
    return [];
  }

  const headerLines = section.lines.slice(0, firstHunkIndex);
  const hunkIndexes: number[] = [];
  section.lines.forEach((line, index) => {
    if (line.startsWith("@@")) {
      hunkIndexes.push(index);
    }
  });

  return hunkIndexes.map((start, index) => {
    const end = hunkIndexes[index + 1] ?? section.lines.length;
    const hunkLines = section.lines.slice(start, end);
    const bodyLines = hunkLines.slice(1);
    const additions = bodyLines.filter(
      (line) => line.startsWith("+") && !line.startsWith("+++"),
    ).length;
    const deletions = bodyLines.filter(
      (line) => line.startsWith("-") && !line.startsWith("---"),
    ).length;
    return {
      id: `${section.path}:${start + 1}`,
      path: section.path,
      header: hunkLines[0] ?? "@@",
      additions,
      deletions,
      lineStart: start + 2,
      lines: bodyLines,
      patch: `${[...headerLines, ...hunkLines].join("\n")}\n`,
    } satisfies DiffHunk;
  });
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
  const { selectedWorkspace } = useWorkspaceUi();
  const runtimeSettings = useRuntimeSettings();
  const { workspaces } = useWorkspaces();
  const queryClient = useQueryClient();
  const matchRoute = useMatchRoute();
  const threadMatch = matchRoute({ to: "/t/$threadId" });
  const threadId = threadMatch ? threadMatch.threadId : undefined;
  const resolvedWorkspacePath = resolveWorkspacePath({
    threadSubtitle: thread?.subtitle,
    selectedWorkspace,
    workspaces,
  });
  const annotationsScope = annotationScopeKey(threadId, resolvedWorkspacePath);
  const { annotations, addAnnotation } = useDiffAnnotations(annotationsScope);
  const diffText = thread?.diffText ?? "";
  const liveDiffText = useThreadDiffText(threadId, diffText);
  const hasLiveDiff = liveDiffText.trim().length > 0;
  const detailSummary = thread?.diffSummary ?? EMPTY_SUMMARY;
  const diffStats = hasLiveDiff
    ? diffStatsFromText(liveDiffText)
    : {
        additions: detailSummary.additions,
        deletions: detailSummary.deletions,
      };
  const summary = useMemo(
    () => ({
      ...detailSummary,
      additions: diffStats.additions,
      deletions: diffStats.deletions,
    }),
    [detailSummary, diffStats.additions, diffStats.deletions],
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
  const [reviewStarting, setReviewStarting] = useState(false);
  const [panelMenuOpen, setPanelMenuOpen] = useState(false);
  const [expandedContextBlocks, setExpandedContextBlocks] = useState<
    Record<string, boolean>
  >({});
  const canRunGitActions = isTauri() && Boolean(resolvedWorkspacePath);
  const panelMenuRef = useRef<HTMLDivElement | null>(null);
  const preferredEditor =
    mockEditors.find(
      (editor) => editor.id === runtimeSettings.openDestination,
    ) ??
    mockEditors.find((editor) => editor.detected) ??
    mockEditors[0];
  const gitStatus = useQuery({
    queryKey: ["git", "status", resolvedWorkspacePath],
    queryFn: () => getGitWorkspaceStatus(resolvedWorkspacePath ?? ""),
    enabled: isTauri() && Boolean(resolvedWorkspacePath),
    refetchInterval: isTauri() ? 10000 : false,
    refetchIntervalInBackground: false,
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
  const selectedSectionDiff = useQuery({
    queryKey: [
      "git",
      "diff",
      resolvedWorkspacePath,
      activeTab,
      selectedSection?.path,
    ],
    queryFn: () =>
      getGitWorkspaceDiff({
        cwd: resolvedWorkspacePath ?? "",
        path: selectedSection?.path ?? "",
        staged: activeTab === "staged",
      }),
    enabled:
      canRunGitActions &&
      Boolean(selectedSection?.path) &&
      Boolean(selectedSection && selectedSection.lines.length === 0),
    staleTime: 1000,
  });
  const selectedSectionWithLiveDiff = useMemo(() => {
    if (!selectedSection) {
      return null;
    }
    if (selectedSection.lines.length > 0) {
      return selectedSection;
    }
    const fallbackDiffText = selectedSectionDiff.data ?? "";
    if (!fallbackDiffText.trim()) {
      return selectedSection;
    }
    const parsed = parseDiffSections(fallbackDiffText, EMPTY_SUMMARY);
    const parsedSection =
      parsed.find((section) => section.path === selectedSection.path) ??
      parsed[0];
    if (!parsedSection) {
      return selectedSection;
    }
    return {
      ...selectedSection,
      additions: parsedSection.additions,
      deletions: parsedSection.deletions,
      lines: parsedSection.lines,
    };
  }, [selectedSection, selectedSectionDiff.data]);
  const selectedHunks = useMemo(
    () =>
      selectedSectionWithLiveDiff
        ? parseDiffHunks(selectedSectionWithLiveDiff)
        : [],
    [selectedSectionWithLiveDiff],
  );
  const selectedHunksWithChunks = useMemo(
    () =>
      selectedHunks.map((hunk) => ({
        hunk,
        chunks: toRenderableChunks(hunk.lines, hunk.lineStart),
      })),
    [selectedHunks],
  );
  const collapsedContextLineCount = useMemo(() => {
    return selectedHunksWithChunks.reduce((total, entry) => {
      return (
        total +
        entry.chunks.reduce((count, chunk) => {
          if (chunk.kind !== "context") {
            return count;
          }
          const contextKey = `${entry.hunk.id}:${chunk.startLineNumber}`;
          return expandedContextBlocks[contextKey]
            ? count
            : count + chunk.lines.length;
        }, 0)
      );
    }, 0);
  }, [expandedContextBlocks, selectedHunksWithChunks]);

  const stagedCount = stagedSections.length;
  const unstagedCount = unstagedSections.length;
  const hunkActionMutation = useMutation({
    mutationFn: async (action: {
      kind:
        | "stage_hunk"
        | "unstage_hunk"
        | "revert_hunk"
        | "stage_all"
        | "revert_all";
      path?: string;
      patch?: string;
      includeStaged?: boolean;
    }) => {
      if (!resolvedWorkspacePath) {
        throw new Error("No workspace available for diff actions.");
      }
      if (action.kind === "stage_all") {
        await stageAllPaths(resolvedWorkspacePath);
        return;
      }
      if (action.kind === "revert_all") {
        await revertAllPaths(
          resolvedWorkspacePath,
          action.includeStaged ?? false,
        );
        return;
      }
      if (!action.patch) {
        throw new Error("No patch data available for this diff action.");
      }
      if (action.kind === "stage_hunk") {
        await stageHunk(resolvedWorkspacePath, action.patch);
        return;
      }
      if (action.kind === "unstage_hunk") {
        await unstageHunk(resolvedWorkspacePath, action.patch);
        return;
      }
      await revertHunk(
        resolvedWorkspacePath,
        action.patch,
        action.includeStaged ?? false,
      );
    },
    onSuccess: async (_, action) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["git", "status", resolvedWorkspacePath],
        }),
        queryClient.invalidateQueries({
          queryKey: ["git", "diff", resolvedWorkspacePath],
        }),
      ]);
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
      if (action.kind === "stage_hunk" && action.path) {
        setHunkActionFeedback(`Staged hunk in ${action.path}`);
        return;
      }
      if (action.kind === "unstage_hunk" && action.path) {
        setHunkActionFeedback(`Unstaged hunk in ${action.path}`);
        return;
      }
      setHunkActionFeedback(`Reverted hunk in ${action.path ?? "file"}`);
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
    if (!panelMenuOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (panelMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setPanelMenuOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [panelMenuOpen]);

  useEffect(() => {
    if (!hunkActionFeedback) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setHunkActionFeedback(null);
    }, 2000);
    return () => window.clearTimeout(timeoutId);
  }, [hunkActionFeedback]);

  const runHunkAction = async (
    action: "stage_hunk" | "unstage_hunk" | "revert_hunk",
    hunk: DiffHunk,
  ) => {
    if (!canRunGitActions) {
      setHunkActionFeedback(null);
      setHunkActionError("Hunk actions are available in the desktop app.");
      return;
    }
    setHunkActionError(null);
    try {
      await hunkActionMutation.mutateAsync({
        kind: action,
        path: hunk.path,
        patch: hunk.patch,
        includeStaged: action === "revert_hunk" && activeTab === "staged",
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
    addAnnotation(annotation);
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

  const handleOpenSelectedFile = async () => {
    const selectedFile =
      selectedSectionWithLiveDiff?.path ?? selectedSection?.path;
    if (!selectedFile || !resolvedWorkspacePath) {
      setHunkActionError("Select a file to open.");
      return;
    }
    if (!isTauri()) {
      setHunkActionError("Open file is available in the desktop app.");
      return;
    }
    const editorCommand = preferredEditor?.command ?? "code";
    const workspaceRoot = resolvedWorkspacePath.replace(/[\\/]+$/, "");
    const normalizedFile = selectedFile.replace(/^[\\/]+/, "");
    const absoluteFilePath = `${workspaceRoot}/${normalizedFile}`;
    try {
      await openInEditor(absoluteFilePath, editorCommand);
      setHunkActionError(null);
      setHunkActionFeedback(`Opened ${selectedFile}.`);
    } catch (error) {
      setHunkActionFeedback(null);
      setHunkActionError(
        error instanceof Error ? error.message : "Failed to open file.",
      );
    }
  };

  const handlePanelMenuAction = async (
    action: "expand-context" | "collapse-context" | "copy-path",
  ) => {
    if (action === "expand-context") {
      const next: Record<string, boolean> = {};
      selectedHunksWithChunks.forEach((entry) => {
        entry.chunks.forEach((chunk) => {
          if (chunk.kind !== "context") {
            return;
          }
          next[`${entry.hunk.id}:${chunk.startLineNumber}`] = true;
        });
      });
      setExpandedContextBlocks((current) => ({
        ...current,
        ...next,
      }));
      setPanelMenuOpen(false);
      return;
    }
    if (action === "collapse-context") {
      setExpandedContextBlocks({});
      setPanelMenuOpen(false);
      return;
    }
    const selectedFile =
      selectedSectionWithLiveDiff?.path ?? selectedSection?.path;
    if (!selectedFile) {
      setHunkActionError("Select a file before copying a path.");
      setPanelMenuOpen(false);
      return;
    }
    try {
      await navigator.clipboard.writeText(selectedFile);
      setHunkActionFeedback("Copied file path.");
      setHunkActionError(null);
    } catch (error) {
      setHunkActionFeedback(null);
      setHunkActionError(
        error instanceof Error ? error.message : "Unable to copy file path.",
      );
    } finally {
      setPanelMenuOpen(false);
    }
  };

  const handleRunReview = async () => {
    if (!threadId) {
      setHunkActionFeedback(null);
      setHunkActionError("No active thread to review.");
      return;
    }
    setReviewOpen(true);
    setReviewStarting(true);
    setHunkActionError(null);
    try {
      await startReview({
        threadId,
        target: { type: "uncommittedChanges" },
        delivery: "inline",
      });
      setHunkActionFeedback("Review started.");
    } catch (error) {
      setHunkActionFeedback(null);
      setHunkActionError(
        error instanceof Error ? error.message : "Failed to start review.",
      );
    } finally {
      setReviewStarting(false);
    }
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
          <button
            className="flex items-center gap-1 text-sm text-ink-100"
            onClick={() => {
              if (unstagedCount && activeTab === "staged") {
                setActiveTab("unstaged");
                return;
              }
              if (stagedCount && activeTab === "unstaged") {
                setActiveTab("staged");
              }
            }}
          >
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
          <button
            className="rounded-full border border-white/10 px-2 py-1 text-[0.65rem] text-ink-300 hover:border-flare-300 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void handleRunReview();
            }}
            disabled={reviewStarting}
            title="Start review"
          >
            {reviewStarting ? "Starting…" : "Run review"}
          </button>
          <button
            className="rounded-full border border-white/10 p-1 hover:border-flare-300"
            onClick={() => {
              void handleOpenSelectedFile();
            }}
            title="Open selected file"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
          <div className="relative" ref={panelMenuRef}>
            <button
              className="rounded-full border border-white/10 p-1 hover:border-flare-300"
              onClick={() => setPanelMenuOpen((open) => !open)}
              title="More diff actions"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {panelMenuOpen ? (
              <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-white/10 bg-ink-900/95 p-1 text-[0.7rem] shadow-card">
                <button
                  className="w-full rounded-lg px-2 py-1.5 text-left text-ink-200 hover:bg-white/5"
                  onClick={() => {
                    void handlePanelMenuAction("expand-context");
                  }}
                >
                  Expand context
                </button>
                <button
                  className="w-full rounded-lg px-2 py-1.5 text-left text-ink-200 hover:bg-white/5"
                  onClick={() => {
                    void handlePanelMenuAction("collapse-context");
                  }}
                >
                  Collapse context
                </button>
                <button
                  className="w-full rounded-lg px-2 py-1.5 text-left text-ink-200 hover:bg-white/5"
                  onClick={() => {
                    void handlePanelMenuAction("copy-path");
                  }}
                >
                  Copy file path
                </button>
              </div>
            ) : null}
          </div>
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
          {selectedSectionWithLiveDiff ? (
            <div
              key={selectedSectionWithLiveDiff.path}
              className="rounded-xl border border-white/10 bg-black/20"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs">
                <span className="text-ink-100">
                  {selectedSectionWithLiveDiff.path}
                </span>
                <span className="text-ink-400">
                  +{selectedSectionWithLiveDiff.additions} -
                  {selectedSectionWithLiveDiff.deletions}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[0.65rem] text-ink-500">
                <span>
                  {collapsedContextLineCount > 0
                    ? `${collapsedContextLineCount} unmodified lines collapsed`
                    : "All unmodified lines shown"}
                </span>
              </div>
              {selectedHunksWithChunks.length ? (
                <div className="divide-y divide-white/5 font-mono text-[0.65rem]">
                  {selectedHunksWithChunks.map(({ hunk, chunks }) => (
                    <div key={hunk.id}>
                      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2 text-[0.62rem] text-ink-400">
                        <span className="truncate">{hunk.header}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-ink-500">
                            +{hunk.additions} -{hunk.deletions}
                          </span>
                          <button
                            className="rounded-full border border-white/10 p-1 hover:border-flare-300 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => {
                              void runHunkAction("revert_hunk", hunk);
                            }}
                            disabled={hunkActionMutation.isPending}
                            title={
                              activeTab === "staged"
                                ? "Revert staged hunk"
                                : "Revert unstaged hunk"
                            }
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                          <button
                            className="rounded-full border border-white/10 p-1 hover:border-flare-300 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => {
                              void runHunkAction(
                                activeTab === "staged"
                                  ? "unstage_hunk"
                                  : "stage_hunk",
                                hunk,
                              );
                            }}
                            disabled={hunkActionMutation.isPending}
                            title={
                              activeTab === "staged"
                                ? "Unstage this hunk"
                                : "Stage this hunk"
                            }
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <div className="divide-y divide-white/5">
                        {chunks.map((chunk) => {
                          if (chunk.kind === "line") {
                            return renderDiffLine(hunk.path, chunk.entry);
                          }
                          const contextKey = `${hunk.id}:${chunk.startLineNumber}`;
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
                                <span>
                                  {chunk.lines.length} unmodified lines
                                </span>
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
                                  hunk.path,
                                  entry,
                                  "text-ink-400 border-transparent bg-black/20",
                                ),
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-3 text-xs text-ink-500">
                  {selectedSectionDiff.isFetching
                    ? "Loading diff preview..."
                    : "No hunk data available for this file."}
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
              {annotations.length} persisted change request
              {annotations.length === 1 ? "" : "s"}.
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
