import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import {
  Code2,
  ChevronDown,
  Copy,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  MoreHorizontal,
  Play,
  Terminal,
  TerminalSquare,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { diffStatsFromText } from "@/app/services/cli/diffSummary";
import { resumeThread, startThread, startTurn } from "@/app/services/cli/turns";
import { useThreadDiffText } from "@/app/services/cli/useThreadDiff";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import {
  openInEditor,
  openPathInCommandPrompt,
  openPathInExplorer,
  openPathInTerminal,
  openPathInWindowsTerminal,
  openTargetOptions,
} from "@/app/services/desktop/open";
import {
  createPullRequest,
  getPrPrerequisiteStatus,
  pushBranch,
  type PrPrerequisiteStatus,
} from "@/app/services/git/commits";
import { useWorkspaceGitStatus } from "@/app/services/git/useWorkspaceGitStatus";
import { checkoutBranch } from "@/app/services/git/worktrees";
import { useAppUi } from "@/app/state/appUi";
import { mockEditors } from "@/app/state/settingsData";
import { useThreadMetadata } from "@/app/state/threadMetadata";
import { useThreadUi } from "@/app/state/threadUi";
import { useRuntimeSettings } from "@/app/state/useRuntimeSettings";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import type { ThreadDetail } from "@/app/types";
import { isTauri } from "@/app/utils/tauri";
import {
  resolveWorkspacePath,
  workspaceNameFromPath,
} from "@/app/utils/workspace";

interface ThreadTopBarProps {
  thread?: ThreadDetail;
  isNewThread?: boolean;
  title?: string;
  isTerminalOpen: boolean;
  onToggleTerminal: () => void;
}

type OpenAction =
  | "editor"
  | "terminal"
  | "explorer"
  | "windows-terminal"
  | "command-prompt";

export function ThreadTopBar({
  thread,
  isNewThread,
  title,
  isTerminalOpen,
  onToggleTerminal,
}: ThreadTopBarProps) {
  const { reviewOpen, setActiveModal, setReviewOpen } = useThreadUi();
  const { selectedWorkspace } = useWorkspaceUi();
  const { composerDraft, setComposerDraft } = useAppUi();
  const runtimeSettings = useRuntimeSettings();
  const { workspaces } = useWorkspaces();
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const threadMatch = matchRoute({ to: "/t/$threadId" });
  const threadId = threadMatch ? threadMatch.threadId : undefined;
  const { metadata } = useThreadMetadata(threadId);
  const detail = thread;
  const resolvedWorkspacePath = resolveWorkspacePath({
    threadSubtitle: detail?.subtitle,
    selectedWorkspace,
    workspaces,
  });
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
  const isWorktree = !isNewThread && Boolean(metadata.worktreePath);
  const headerTitle = isNewThread
    ? "New thread"
    : (detail?.title ?? title ?? "Codex");
  const {
    status: gitStatus,
    error: gitStatusError,
    isLoading: gitStatusLoading,
  } = useWorkspaceGitStatus(resolvedWorkspacePath);
  const gitStatusMessage =
    gitStatusError instanceof Error ? gitStatusError.message : null;
  const gitUnavailable = Boolean(gitStatusMessage);
  const canGitOperate = Boolean(resolvedWorkspacePath) && !gitUnavailable;
  const hasWorkspaceChanges =
    (gitStatus?.stagedPaths.length ?? 0) +
      (gitStatus?.unstagedPaths.length ?? 0) >
    0;
  const hasChanges = canGitOperate && (hasWorkspaceChanges || hasThreadChanges);
  const gitBranch =
    gitStatus?.branch ?? metadata.branch ?? detail?.branch ?? "main";
  const aheadCount = gitStatus?.ahead ?? 0;
  const behindCount = gitStatus?.behind ?? 0;
  const hasOutgoingCommits = aheadCount > 0;
  const onDefaultBranch = gitBranch === runtimeSettings.defaultBranch;

  const [runMenuOpen, setRunMenuOpen] = useState(false);
  const [openMenuOpen, setOpenMenuOpen] = useState(false);
  const [gitMenuOpen, setGitMenuOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runPrompt, setRunPrompt] = useState("");
  const [runError, setRunError] = useState<string | null>(null);
  const [runSubmitting, setRunSubmitting] = useState(false);
  const [openMessage, setOpenMessage] = useState<string | null>(null);
  const [gitMessage, setGitMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [gitSubmitting, setGitSubmitting] = useState<"push" | "pr" | null>(
    null,
  );
  const [prPrerequisiteStatus, setPrPrerequisiteStatus] =
    useState<PrPrerequisiteStatus | null>(null);
  const [prPrerequisiteLoading, setPrPrerequisiteLoading] = useState(false);
  const [showPrGuidance, setShowPrGuidance] = useState(false);
  const runMenuRef = useRef<HTMLDivElement | null>(null);
  const openMenuRef = useRef<HTMLDivElement | null>(null);
  const gitMenuRef = useRef<HTMLDivElement | null>(null);
  const headerMenuRef = useRef<HTMLDivElement | null>(null);
  const preferredEditor =
    mockEditors.find(
      (editor) => editor.id === runtimeSettings.openDestination,
    ) ??
    mockEditors.find((editor) => editor.detected) ??
    mockEditors[0];
  const preferredEditorName = preferredEditor?.name ?? "Editor";
  const preferredEditorCommand = preferredEditor?.command ?? "code";
  const openTargets = openTargetOptions(preferredEditorName);

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

  useEffect(() => {
    if (!headerMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (headerMenuRef.current?.contains(event.target as Node)) return;
      setHeaderMenuOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [headerMenuOpen]);

  useEffect(() => {
    if (!gitMenuOpen || !resolvedWorkspacePath || !isTauri()) {
      return;
    }
    let cancelled = false;
    setPrPrerequisiteLoading(true);
    void getPrPrerequisiteStatus(resolvedWorkspacePath)
      .then((status) => {
        if (cancelled) {
          return;
        }
        setPrPrerequisiteStatus(status);
        if (!status.ready) {
          setShowPrGuidance(true);
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setPrPrerequisiteStatus({
          ready: false,
          reason:
            error instanceof Error
              ? error.message
              : "Unable to validate PR prerequisites.",
          steps: [
            "Run `gh --version` to verify the GitHub CLI installation.",
            "Run `gh auth login` before creating a PR.",
          ],
        });
        setShowPrGuidance(true);
      })
      .finally(() => {
        if (!cancelled) {
          setPrPrerequisiteLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [gitMenuOpen, resolvedWorkspacePath]);

  const handleCheckoutLocal = async () => {
    const branch = metadata.branch ?? detail?.branch;
    const workspacePath = resolvedWorkspacePath;
    if (!workspacePath) return;
    if (!branch) return;
    try {
      await checkoutBranch(workspacePath, branch);
    } catch (error) {
      console.warn("Failed to checkout branch", error);
    }
  };

  const startRunForPrompt = async (prompt: string) => {
    if (!isTauri()) {
      throw new Error("Runs are available in the desktop app.");
    }
    if (!resolvedWorkspacePath) {
      throw new Error("Select a workspace before running.");
    }
    let targetThreadId = threadId;
    const shouldStartNewThread =
      !targetThreadId ||
      runtimeSettings.followUpBehavior === "new-thread" ||
      (runtimeSettings.followUpBehavior === "ask" &&
        window.confirm(
          "Start a new thread for this run? Click Cancel to append in the current thread.",
        ));

    if (shouldStartNewThread) {
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
      input: prompt,
      cwd: resolvedWorkspacePath,
    });
  };

  const handleRun = async () => {
    if (!runPrompt.trim()) {
      setRunError("Enter a prompt to run.");
      return;
    }
    setRunSubmitting(true);
    setRunError(null);
    try {
      await startRunForPrompt(runPrompt.trim());
      setRunPrompt("");
      setRunModalOpen(false);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Failed to run.");
    } finally {
      setRunSubmitting(false);
    }
  };

  const handleRunPrimary = async () => {
    const draft = composerDraft.trim();
    if (!draft) {
      setRunError(null);
      setRunModalOpen(true);
      return;
    }
    setRunSubmitting(true);
    setRunError(null);
    try {
      await startRunForPrompt(draft);
      setComposerDraft("");
    } catch (error) {
      setRunPrompt(draft);
      setRunModalOpen(true);
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

  const handleOpenAction = async (action: OpenAction) => {
    if (!resolvedWorkspacePath) {
      showOpenMessage("No workspace selected.");
      return;
    }
    if (!isTauri()) {
      showOpenMessage("Open actions are available in the desktop app.");
      return;
    }
    try {
      if (action === "editor") {
        await openInEditor(resolvedWorkspacePath, preferredEditorCommand);
        showOpenMessage(`Opened in ${preferredEditorName}.`);
        return;
      }
      if (action === "windows-terminal") {
        await openPathInWindowsTerminal(resolvedWorkspacePath);
        showOpenMessage("Opened in Windows Terminal.");
        return;
      }
      if (action === "command-prompt") {
        await openPathInCommandPrompt(resolvedWorkspacePath);
        showOpenMessage("Opened in Command Prompt.");
        return;
      }
      if (action === "terminal") {
        await openPathInTerminal(resolvedWorkspacePath);
        showOpenMessage("Opened in terminal.");
        return;
      }
      await openPathInExplorer(resolvedWorkspacePath);
      showOpenMessage("Opened in file explorer.");
    } catch (error) {
      showOpenMessage(
        error instanceof Error ? error.message : "Open action failed.",
      );
    }
  };

  const openActionIcon = (action: OpenAction) => {
    if (action === "editor") {
      return <Code2 className="h-3.5 w-3.5" />;
    }
    if (action === "explorer") {
      return <FolderOpen className="h-3.5 w-3.5" />;
    }
    return action === "terminal" ? (
      <Terminal className="h-3.5 w-3.5" />
    ) : (
      <TerminalSquare className="h-3.5 w-3.5" />
    );
  };

  const showGitMessage = (message: string) => {
    setGitMessage(message);
    window.setTimeout(() => setGitMessage(null), 2500);
  };

  const showCopyMessage = (message: string) => {
    setCopyMessage(message);
    window.setTimeout(() => setCopyMessage(null), 2000);
  };

  const handlePush = async () => {
    if (!resolvedWorkspacePath) {
      showGitMessage("No workspace selected.");
      return;
    }
    if (!canGitOperate) {
      showGitMessage(
        gitStatusMessage ?? "Git is unavailable in this workspace.",
      );
      return;
    }
    if (!hasOutgoingCommits) {
      showGitMessage("No local commits to push.");
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
    if (!canGitOperate) {
      showGitMessage(
        gitStatusMessage ?? "Git is unavailable in this workspace.",
      );
      return;
    }
    if (onDefaultBranch) {
      showGitMessage(
        `Switch off ${runtimeSettings.defaultBranch} before creating a PR.`,
      );
      return;
    }
    if (!hasOutgoingCommits) {
      showGitMessage("Push commits first before creating a PR.");
      return;
    }
    if (!isTauri()) {
      showGitMessage("Create PR is available in the desktop app.");
      return;
    }
    setGitSubmitting("pr");
    try {
      const prerequisiteStatus = await getPrPrerequisiteStatus(
        resolvedWorkspacePath,
      );
      setPrPrerequisiteStatus(prerequisiteStatus);
      if (!prerequisiteStatus.ready) {
        setShowPrGuidance(true);
        return;
      }
      await createPullRequest(resolvedWorkspacePath);
      setShowPrGuidance(false);
      showGitMessage("Pull request created.");
    } catch (error) {
      showGitMessage(
        error instanceof Error ? error.message : "Failed to create PR.",
      );
    } finally {
      setGitSubmitting(null);
    }
  };

  const handleCopyContext = async () => {
    const threadLink = threadId
      ? new URL(`/t/${threadId}`, window.location.origin).toString()
      : null;
    const fallbackPath = resolvedWorkspacePath;
    const copyValue = threadLink ?? fallbackPath;
    if (!copyValue) {
      showCopyMessage("Nothing to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(copyValue);
      showCopyMessage(threadLink ? "Thread link copied." : "Path copied.");
    } catch (error) {
      console.warn("Failed to copy context", error);
      showCopyMessage("Unable to copy.");
    }
  };

  const canCommit = canGitOperate && hasChanges;
  const canPush = canGitOperate && hasOutgoingCommits && gitSubmitting === null;
  const canCreatePr =
    canGitOperate &&
    !onDefaultBranch &&
    hasOutgoingCommits &&
    (prPrerequisiteStatus?.ready ?? false) &&
    gitSubmitting === null;

  const gitActionHint =
    gitStatusLoading && !gitStatus
      ? "Checking repository status…"
      : !canGitOperate
        ? (gitStatusMessage ?? "Git is unavailable for this workspace.")
        : onDefaultBranch
          ? `Create a feature branch off ${runtimeSettings.defaultBranch}.`
          : !hasOutgoingCommits
            ? "No local commits to push or create a PR."
            : prPrerequisiteStatus && !prPrerequisiteStatus.ready
              ? (prPrerequisiteStatus.reason ?? "PR prerequisites are not met.")
              : null;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-ink-900/70 px-6 py-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-lg text-ink-50">{headerTitle}</h1>
          <span className="text-xs text-ink-400">{subtitle}</span>
          <div className="relative" ref={headerMenuRef}>
            <button
              className="btn-flat px-2 text-ink-400"
              onClick={() => setHeaderMenuOpen((open) => !open)}
              aria-label="Thread options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {headerMenuOpen ? (
              <div className="surface-panel absolute left-0 top-8 z-20 w-52 p-2 text-[0.7rem] text-ink-200">
                <button
                  className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    void handleCopyContext();
                  }}
                >
                  {threadId ? "Copy thread link" : "Copy workspace path"}
                </button>
                <button
                  className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    void navigate({
                      to: "/settings/$section",
                      params: { section: "general" },
                    });
                  }}
                >
                  Open settings
                </button>
                <button
                  className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    setReviewOpen(!reviewOpen);
                  }}
                >
                  {reviewOpen ? "Hide review panel" : "Show review panel"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="relative" ref={runMenuRef}>
          <div className="flex items-center">
            <button
              className="flex items-center gap-2 rounded-l-full border border-white/10 border-r-0 px-3 py-1 hover:border-flare-300 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                void handleRunPrimary();
              }}
              disabled={runSubmitting}
            >
              <Play className="h-3.5 w-3.5" />
              {runSubmitting ? "Running…" : "Run"}
            </button>
            <button
              className="rounded-r-full border border-white/10 px-2 py-1 hover:border-flare-300 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setRunMenuOpen((open) => !open)}
              aria-label="Run options"
              disabled={runSubmitting}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          {runMenuOpen ? (
            <div className="surface-panel absolute right-0 mt-2 w-48 p-2 text-[0.7rem] text-ink-200">
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
            <div className="surface-panel absolute right-0 mt-2 w-56 p-2 text-[0.7rem] text-ink-200">
              <button
                className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5"
                onClick={() => {
                  void handleCopyPath();
                  setOpenMenuOpen(false);
                }}
              >
                Copy path
              </button>
              {openTargets.map((target) => (
                <button
                  key={target.id}
                  className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5"
                  onClick={() => {
                    void handleOpenAction(target.id);
                    setOpenMenuOpen(false);
                  }}
                >
                  <span className="flex items-center gap-2 text-ink-100">
                    {openActionIcon(target.id)}
                    {target.label}
                  </span>
                  <span className="pl-[1.4rem] text-[0.62rem] text-ink-500">
                    {target.detail}
                  </span>
                </button>
              ))}
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
              disabled={!canGitOperate}
            >
              Checkout on local
            </button>
            <button
              className="rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-ink-50 hover:bg-flare-400/20"
              onClick={() => setActiveModal("branch")}
              disabled={!canGitOperate}
            >
              Create branch here
            </button>
            <button
              className="rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-ink-50 hover:bg-flare-400/20 disabled:opacity-50"
              onClick={() => setActiveModal("merge")}
              disabled={!canGitOperate}
            >
              Bring back to main
            </button>
          </>
        ) : canCommit ? (
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
            className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 hover:border-flare-300 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setGitMenuOpen((open) => !open)}
            disabled={!resolvedWorkspacePath}
          >
            <GitCommitHorizontal className="h-3.5 w-3.5" />
            Git
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {gitMenuOpen ? (
            <div className="surface-panel absolute right-0 mt-2 w-56 p-2 text-[0.7rem] text-ink-200">
              <button
                className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  setGitMenuOpen(false);
                  setActiveModal("commit");
                }}
                disabled={!canCommit}
              >
                Commit changes
              </button>
              <button
                className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  setGitMenuOpen(false);
                  void handlePush();
                }}
                disabled={!canPush}
              >
                {gitSubmitting === "push" ? "Pushing…" : `Push ${gitBranch}`}
              </button>
              <button
                className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  setGitMenuOpen(false);
                  void handleCreatePr();
                }}
                disabled={!canCreatePr}
              >
                {gitSubmitting === "pr" ? "Creating PR…" : "Create PR"}
              </button>
              {prPrerequisiteLoading ? (
                <p className="px-3 py-2 text-[0.65rem] text-ink-400">
                  Checking PR prerequisites…
                </p>
              ) : null}
              {showPrGuidance &&
              prPrerequisiteStatus &&
              !prPrerequisiteStatus.ready ? (
                <div className="mt-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[0.65rem] text-ink-300">
                  <p>{prPrerequisiteStatus.reason}</p>
                  {prPrerequisiteStatus.steps.map((step) => (
                    <p key={step} className="mt-1 text-ink-400">
                      - {step}
                    </p>
                  ))}
                  <button
                    className="mt-2 rounded-full border border-white/10 px-2 py-1 text-[0.6rem] hover:border-flare-300"
                    onClick={() => setShowPrGuidance(false)}
                  >
                    Dismiss
                  </button>
                </div>
              ) : null}
              {gitActionHint ? (
                <p className="px-3 py-2 text-[0.65rem] text-ink-500">
                  {gitActionHint}
                </p>
              ) : null}
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
        <button
          className="btn-flat inline-flex items-center gap-2"
          onClick={() => {
            void handleCopyContext();
          }}
          title={threadId ? "Copy thread link" : "Copy workspace path"}
          aria-label={threadId ? "Copy thread link" : "Copy workspace path"}
        >
          <Copy className="h-3.5 w-3.5" />
          <span>{threadId ? "Copy link" : "Copy path"}</span>
        </button>
        {copyMessage ? (
          <span className="text-[0.65rem] text-ink-400">{copyMessage}</span>
        ) : null}
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
