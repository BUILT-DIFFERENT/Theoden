import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  Copy,
  GitBranch,
  GitCommitHorizontal,
  MoreHorizontal,
  Play,
  Terminal,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { diffStatsFromText } from "@/app/services/cli/diffSummary";
import { resumeThread, startThread, startTurn } from "@/app/services/cli/turns";
import { useThreadDiffText } from "@/app/services/cli/useThreadDiff";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { createPullRequest, pushBranch } from "@/app/services/git/commits";
import { useWorkspaceGitStatus } from "@/app/services/git/useWorkspaceGitStatus";
import { checkoutBranch } from "@/app/services/git/worktrees";
import { useThreadMetadata } from "@/app/state/threadMetadata";
import { useThreadUi } from "@/app/state/threadUi";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import type { ThreadDetail } from "@/app/types";
import { isTauri } from "@/app/utils/tauri";
import { workspaceNameFromPath } from "@/app/utils/workspace";

interface ThreadTopBarProps {
  thread?: ThreadDetail;
  isNewThread?: boolean;
  title?: string;
  isTerminalOpen: boolean;
  onToggleTerminal: () => void;
}

function isLikelyWorkspacePath(value: string): boolean {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return false;
  }
  return (
    /^[a-zA-Z]:[\\/]/.test(trimmedValue) ||
    trimmedValue.startsWith("/") ||
    trimmedValue.startsWith("\\\\")
  );
}

export function ThreadTopBar({
  thread,
  isNewThread,
  title,
  isTerminalOpen,
  onToggleTerminal,
}: ThreadTopBarProps) {
  const { reviewOpen, setActiveModal, setReviewOpen } = useThreadUi();
  const { selectedWorkspace } = useWorkspaceUi();
  const { workspaces } = useWorkspaces();
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const threadMatch = matchRoute({ to: "/t/$threadId" });
  const threadId = threadMatch ? threadMatch.threadId : undefined;
  const { metadata } = useThreadMetadata(threadId);
  const detail = thread;
  const threadWorkspacePath =
    detail?.subtitle && isLikelyWorkspacePath(detail.subtitle)
      ? detail.subtitle
      : null;
  const fallbackWorkspace =
    threadWorkspacePath ?? selectedWorkspace ?? workspaces[0]?.path ?? null;
  const resolvedWorkspacePath = fallbackWorkspace;
  const subtitle = resolvedWorkspacePath
    ? workspaceNameFromPath(resolvedWorkspacePath)
    : "Pick a workspace";
  const liveDiffText = useThreadDiffText(threadId, detail?.diffText ?? "");
  const hasLiveDiff = liveDiffText.trim().length > 0;
  const liveStats = hasLiveDiff
    ? diffStatsFromText(liveDiffText)
    : {
        additions: detail?.diffSummary.additions ?? 0,
        deletions: detail?.diffSummary.deletions ?? 0,
      };
  const emptySummary = {
    filesChanged: 0,
    additions: 0,
    deletions: 0,
    files: [],
  };
  const summary = isNewThread
    ? emptySummary
    : {
        ...(detail?.diffSummary ?? emptySummary),
        additions: liveStats.additions,
        deletions: liveStats.deletions,
      };
  const hasThreadChanges = !isNewThread && summary.filesChanged > 0;
  const isWorktree = !isNewThread && detail?.mode === "worktree";
  const headerTitle = isNewThread
    ? "New thread"
    : (detail?.title ?? title ?? "Codex");
  const { status: gitStatus } = useWorkspaceGitStatus(resolvedWorkspacePath);
  const hasWorkspaceChanges =
    (gitStatus?.stagedPaths.length ?? 0) +
      (gitStatus?.unstagedPaths.length ?? 0) >
    0;
  const hasChanges = hasWorkspaceChanges || hasThreadChanges;
  const gitBranch =
    gitStatus?.branch ?? metadata.branch ?? detail?.branch ?? "main";
  const aheadCount = gitStatus?.ahead ?? 0;
  const behindCount = gitStatus?.behind ?? 0;

  const [runMenuOpen, setRunMenuOpen] = useState(false);
  const [openMenuOpen, setOpenMenuOpen] = useState(false);
  const [gitMenuOpen, setGitMenuOpen] = useState(false);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runPrompt, setRunPrompt] = useState("");
  const [runError, setRunError] = useState<string | null>(null);
  const [runSubmitting, setRunSubmitting] = useState(false);
  const [openMessage, setOpenMessage] = useState<string | null>(null);
  const [gitMessage, setGitMessage] = useState<string | null>(null);
  const [gitSubmitting, setGitSubmitting] = useState<"push" | "pr" | null>(
    null,
  );
  const runMenuRef = useRef<HTMLDivElement | null>(null);
  const openMenuRef = useRef<HTMLDivElement | null>(null);
  const gitMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!runMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (runMenuRef.current?.contains(event.target as Node)) return;
      setRunMenuOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [runMenuOpen]);

  useEffect(() => {
    if (!openMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (openMenuRef.current?.contains(event.target as Node)) return;
      setOpenMenuOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [openMenuOpen]);

  useEffect(() => {
    if (!gitMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (gitMenuRef.current?.contains(event.target as Node)) return;
      setGitMenuOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [gitMenuOpen]);

  const handleCheckoutLocal = async () => {
    const branch = metadata.branch ?? detail?.branch;
    const workspacePath = threadWorkspacePath ?? resolvedWorkspacePath;
    if (!workspacePath) return;
    if (!branch) return;
    try {
      await checkoutBranch(workspacePath, branch);
    } catch (error) {
      console.warn("Failed to checkout branch", error);
    }
  };

  const handleRun = async () => {
    if (!isTauri()) {
      setRunError("Runs are available in the desktop app.");
      return;
    }
    if (!runPrompt.trim()) {
      setRunError("Enter a prompt to run.");
      return;
    }
    if (!resolvedWorkspacePath) {
      setRunError("Select a workspace before running.");
      return;
    }
    setRunSubmitting(true);
    setRunError(null);
    try {
      let targetThreadId = threadId;
      if (!targetThreadId) {
        const newThread = await startThread({ cwd: resolvedWorkspacePath });
        targetThreadId = newThread?.id;
        if (targetThreadId) {
          await navigate({
            to: "/t/$threadId",
            params: { threadId: targetThreadId },
          });
        }
      }
      if (!targetThreadId) {
        throw new Error("Unable to start a new thread.");
      }
      await resumeThread({ threadId: targetThreadId });
      await startTurn({
        threadId: targetThreadId,
        input: runPrompt.trim(),
        cwd: resolvedWorkspacePath,
      });
      setRunPrompt("");
      setRunModalOpen(false);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Failed to run.");
    } finally {
      setRunSubmitting(false);
    }
  };

  const showOpenMessage = (message: string) => {
    setOpenMessage(message);
    window.setTimeout(() => setOpenMessage(null), 2000);
  };

  const handleCopyPath = async () => {
    if (!resolvedWorkspacePath) {
      showOpenMessage("No workspace selected.");
      return;
    }
    try {
      await navigator.clipboard.writeText(resolvedWorkspacePath);
      showOpenMessage("Path copied.");
    } catch (error) {
      console.warn("Failed to copy path", error);
      showOpenMessage("Unable to copy path.");
    }
  };

  const handleOpenAction = (label: string) => {
    if (!resolvedWorkspacePath) {
      showOpenMessage("No workspace selected.");
      return;
    }
    if (!isTauri()) {
      showOpenMessage("Open actions are available in the desktop app.");
      return;
    }
    console.info(label, resolvedWorkspacePath);
    showOpenMessage(`${label} requested.`);
  };

  const showGitMessage = (message: string) => {
    setGitMessage(message);
    window.setTimeout(() => setGitMessage(null), 2500);
  };

  const handlePush = async () => {
    if (!resolvedWorkspacePath) {
      showGitMessage("No workspace selected.");
      return;
    }
    if (!isTauri()) {
      showGitMessage("Push is available in the desktop app.");
      return;
    }
    setGitSubmitting("push");
    try {
      await pushBranch(resolvedWorkspacePath, gitBranch);
      showGitMessage(`Pushed ${gitBranch}.`);
    } catch (error) {
      showGitMessage(
        error instanceof Error ? error.message : "Failed to push branch.",
      );
    } finally {
      setGitSubmitting(null);
    }
  };

  const handleCreatePr = async () => {
    if (!resolvedWorkspacePath) {
      showGitMessage("No workspace selected.");
      return;
    }
    if (!isTauri()) {
      showGitMessage("Create PR is available in the desktop app.");
      return;
    }
    setGitSubmitting("pr");
    try {
      await createPullRequest(resolvedWorkspacePath);
      showGitMessage("Pull request created.");
    } catch (error) {
      showGitMessage(
        error instanceof Error ? error.message : "Failed to create PR.",
      );
    } finally {
      setGitSubmitting(null);
    }
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-black/20 px-6 py-4 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-lg text-ink-50">{headerTitle}</h1>
          <span className="text-xs text-ink-400">{subtitle}</span>
          <button className="rounded-full border border-white/10 p-1 text-ink-400 hover:border-flare-300">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="relative" ref={runMenuRef}>
          <button
            className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
            onClick={() => setRunMenuOpen((open) => !open)}
          >
            <Play className="h-3.5 w-3.5" />
            Run
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {runMenuOpen ? (
            <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-white/10 bg-ink-900/95 p-2 text-[0.7rem] text-ink-200 shadow-card">
              <button
                className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5"
                onClick={() => {
                  setRunMenuOpen(false);
                  setRunModalOpen(true);
                }}
              >
                Start new run
              </button>
              <button
                className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5"
                onClick={() => {
                  setRunMenuOpen(false);
                  setReviewOpen(true);
                }}
              >
                Review changes
              </button>
            </div>
          ) : null}
        </div>
        <div className="relative" ref={openMenuRef}>
          <button
            className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
            onClick={() => setOpenMenuOpen((open) => !open)}
          >
            Open
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {openMenuOpen ? (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/10 bg-ink-900/95 p-2 text-[0.7rem] text-ink-200 shadow-card">
              <button
                className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5"
                onClick={() => {
                  void handleCopyPath();
                  setOpenMenuOpen(false);
                }}
              >
                Copy path
              </button>
              <button
                className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5"
                onClick={() => {
                  handleOpenAction("Open in terminal");
                  setOpenMenuOpen(false);
                }}
              >
                Open in terminal
              </button>
              <button
                className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5"
                onClick={() => {
                  handleOpenAction("Open in file explorer");
                  setOpenMenuOpen(false);
                }}
              >
                Open in file explorer
              </button>
              {openMessage ? (
                <p className="px-3 py-2 text-[0.65rem] text-ink-400">
                  {openMessage}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        {isWorktree ? (
          <>
            <button
              className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
              onClick={() => {
                void handleCheckoutLocal();
              }}
            >
              Checkout on local
            </button>
            <button
              className="rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-ink-50 hover:bg-flare-400/20"
              onClick={() => setActiveModal("branch")}
            >
              Create branch here
            </button>
          </>
        ) : hasChanges ? (
          <button
            className="flex items-center gap-2 rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-ink-50 hover:bg-flare-400/20"
            onClick={() => setActiveModal("commit")}
          >
            Commit
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <div className="relative" ref={gitMenuRef}>
          <button
            className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
            onClick={() => setGitMenuOpen((open) => !open)}
          >
            <GitCommitHorizontal className="h-3.5 w-3.5" />
            Git
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {gitMenuOpen ? (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/10 bg-ink-900/95 p-2 text-[0.7rem] text-ink-200 shadow-card">
              <button
                className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5"
                onClick={() => {
                  setGitMenuOpen(false);
                  setActiveModal("commit");
                }}
              >
                Commit changes
              </button>
              <button
                className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  setGitMenuOpen(false);
                  void handlePush();
                }}
                disabled={gitSubmitting !== null}
              >
                {gitSubmitting === "push" ? "Pushing…" : `Push ${gitBranch}`}
              </button>
              <button
                className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  setGitMenuOpen(false);
                  void handleCreatePr();
                }}
                disabled={gitSubmitting !== null}
              >
                {gitSubmitting === "pr" ? "Creating PR…" : "Create PR"}
              </button>
              {gitMessage ? (
                <p className="px-3 py-2 text-[0.65rem] text-ink-400">
                  {gitMessage}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          className={`flex items-center gap-2 rounded-full border px-3 py-1 transition ${
            reviewOpen
              ? "border-flare-300 bg-flare-400/10 text-ink-50"
              : "border-white/10 text-ink-300 hover:border-flare-300"
          }`}
          onClick={() => setReviewOpen(!reviewOpen)}
        >
          <GitBranch className="h-3.5 w-3.5" />
          {gitBranch}
          <span className="text-ink-400">+{aheadCount}</span>
          <span className="text-ink-500">-{behindCount}</span>
        </button>
        <button className="rounded-full border border-white/10 p-2 text-ink-300 hover:border-flare-300">
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          className={`flex items-center gap-2 rounded-full border px-3 py-1 transition ${
            isTerminalOpen
              ? "border-flare-300 bg-flare-400/10 text-ink-50"
              : "border-white/10 text-ink-300 hover:border-flare-300"
          }`}
          onClick={onToggleTerminal}
          title="Toggle terminal (Ctrl/Cmd+J)"
        >
          <Terminal className="h-3.5 w-3.5" />
          Terminal
          <span className="text-[0.65rem] text-ink-500">Ctrl/Cmd+J</span>
        </button>
      </div>
      {runModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-ink-900/95 p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-ink-50">Start a run</h3>
              <button
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-ink-300 hover:border-flare-300"
                onClick={() => {
                  setRunModalOpen(false);
                  setRunError(null);
                }}
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-ink-300">
              <p className="text-xs text-ink-500">
                Workspace:{" "}
                <span className="text-ink-200">
                  {resolvedWorkspacePath ?? "Select a workspace"}
                </span>
              </p>
              <textarea
                className="h-28 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-ink-100 placeholder:text-ink-500"
                placeholder="Ask Codex anything, @ to add files, / for commands"
                value={runPrompt}
                onChange={(event) => setRunPrompt(event.target.value)}
              />
              {runError ? (
                <p className="text-xs text-rose-300">{runError}</p>
              ) : null}
              <div className="flex justify-end gap-2 text-xs">
                <button
                  className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
                  onClick={() => {
                    setRunModalOpen(false);
                    setRunError(null);
                  }}
                  disabled={runSubmitting}
                >
                  Cancel
                </button>
                <button
                  className="rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-ink-50 hover:bg-flare-400/20 disabled:opacity-60"
                  onClick={() => {
                    void handleRun();
                  }}
                  disabled={runSubmitting}
                >
                  {runSubmitting ? "Running…" : "Run"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
