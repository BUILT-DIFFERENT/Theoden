import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowUp,
  ChevronDown,
  GitBranch,
  Paperclip,
  Lock,
  Plus,
  Settings,
  Square,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { clearActiveRun, getActiveRun } from "@/app/services/cli/activeRuns";
import { getWorkspaceFileIndex } from "@/app/services/cli/fileIndex";
import {
  cancelTurn,
  resumeThread,
  startThread,
  startTurn,
} from "@/app/services/cli/turns";
import { useRunProgress } from "@/app/services/cli/useRunProgress";
import { useThreadDetail } from "@/app/services/cli/useThreadDetail";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { useWorkspaceBranches } from "@/app/services/git/useWorkspaceBranches";
import { useWorkspaceGitStatus } from "@/app/services/git/useWorkspaceGitStatus";
import { checkoutBranch } from "@/app/services/git/worktrees";
import { type QualityPreset, useAppUi } from "@/app/state/appUi";
import { useEnvironmentUi } from "@/app/state/environmentUi";
import { useThreadUi } from "@/app/state/threadUi";
import { useRuntimeSettings } from "@/app/state/useRuntimeSettings";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import { isTauri } from "@/app/utils/tauri";
import {
  resolveWorkspacePath,
  workspaceNameFromPath,
} from "@/app/utils/workspace";

const qualityLabels: Record<QualityPreset, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  extra_high: "Extra high",
};
const environmentModes = ["local", "worktree", "cloud"] as const;
const effortFromQuality: Record<
  QualityPreset,
  "medium" | "high" | "xhigh" | null
> = {
  low: null,
  medium: "medium",
  high: "high",
  extra_high: "xhigh",
};

const modelOptions = ["GPT-5.2-Codex", "GPT-5", "o4-mini"] as const;
const commandOptions = [
  {
    id: "summarize",
    label: "Summarize changes",
    description: "Ask for a concise summary of current modifications.",
  },
  {
    id: "tests",
    label: "Run tests",
    description: "Ask Codex to execute relevant tests for the current task.",
  },
  {
    id: "review",
    label: "Review code",
    description: "Ask Codex to perform a focused bug-risk review.",
  },
  {
    id: "plan",
    label: "Update plan",
    description: "Ask Codex to refresh plan/checklist progress.",
  },
] as const;

type CommandOptionId = (typeof commandOptions)[number]["id"];

type InlineMenuType = "file" | "command";

interface InlineMenuState {
  type: InlineMenuType;
  query: string;
  tokenStart: number;
  tokenEnd: number;
}

interface ThreadComposerProps {
  prefillPrompt?: string;
  workspaceName?: string;
  placeholder?: string;
  onSubmitted?: (message: string) => void;
}

export function ThreadComposer({
  prefillPrompt,
  workspaceName,
  placeholder,
  onSubmitted,
}: ThreadComposerProps) {
  const matchRoute = useMatchRoute();
  const threadMatch = matchRoute({ to: "/t/$threadId" });
  const threadId = threadMatch ? threadMatch.threadId : undefined;
  const navigate = useNavigate();
  const { thread: threadDetail } = useThreadDetail(threadId);
  const thread = threadId ? threadDetail : undefined;
  const runProgress = useRunProgress(threadId);
  const { setActiveModal, setReviewOpen } = useThreadUi();
  const { environmentMode, setEnvironmentMode } = useEnvironmentUi();
  const runtimeSettings = useRuntimeSettings();
  const queryClient = useQueryClient();
  const {
    activeModel,
    setActiveModel,
    qualityPreset,
    setQualityPreset,
    composerDraft,
    setComposerDraft,
  } = useAppUi();
  const { workspaces } = useWorkspaces();
  const { selectedWorkspace, setWorkspacePickerOpen } = useWorkspaceUi();
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const branchMenuRef = useRef<HTMLDivElement | null>(null);
  const [attachmentsDrawerOpen, setAttachmentsDrawerOpen] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);
  const [inlineMenu, setInlineMenu] = useState<InlineMenuState | null>(null);
  const [inlineSelectionIndex, setInlineSelectionIndex] = useState(0);
  const [indexedWorkspaceFiles, setIndexedWorkspaceFiles] = useState<string[]>(
    [],
  );
  const [indexingFiles, setIndexingFiles] = useState(false);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [isContextLocked, setIsContextLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (prefillPrompt) {
      setComposerDraft(prefillPrompt);
    }
  }, [prefillPrompt, setComposerDraft]);

  useEffect(() => {
    if (!thread?.mode) return;
    setEnvironmentMode(thread.mode);
  }, [setEnvironmentMode, thread?.mode]);
  const isRunning = runProgress.isActive;
  const isBusy = isSubmitting || isRunning || isStopping;
  const resolvedWorkspacePath = resolveWorkspacePath({
    threadSubtitle: thread?.subtitle,
    selectedWorkspace,
    workspaces,
    fallbackWorkspace: workspaceName,
  });
  const canSubmit = useMemo(() => {
    return (
      !isBusy &&
      composerDraft.trim().length > 0 &&
      Boolean(resolvedWorkspacePath)
    );
  }, [composerDraft, isBusy, resolvedWorkspacePath]);

  useEffect(() => {
    if (!resolvedWorkspacePath) {
      setIndexedWorkspaceFiles([]);
      return;
    }
    if (!attachmentsDrawerOpen && inlineMenu?.type !== "file") {
      return;
    }

    let cancelled = false;
    setIndexingFiles(true);
    const timeoutId = window.setTimeout(() => {
      getWorkspaceFileIndex(resolvedWorkspacePath)
        .then((files) => {
          if (!cancelled) {
            setIndexedWorkspaceFiles(files);
          }
        })
        .catch((indexError) => {
          if (!cancelled) {
            setError(
              indexError instanceof Error
                ? indexError.message
                : "Failed to build workspace file index.",
            );
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIndexingFiles(false);
          }
        });
    }, 140);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    attachmentsDrawerOpen,
    inlineMenu?.query,
    inlineMenu?.type,
    resolvedWorkspacePath,
  ]);

  const availableAttachmentOptions = useMemo(() => {
    const options = new Set<string>();
    thread?.attachments.forEach((attachment) => options.add(attachment.path));
    thread?.diffSummary.files.forEach((file) => options.add(file.path));
    indexedWorkspaceFiles.forEach((path) => options.add(path));
    return Array.from(options);
  }, [indexedWorkspaceFiles, thread?.attachments, thread?.diffSummary.files]);
  const inlineFileOptions = useMemo(() => {
    if (inlineMenu?.type !== "file") {
      return [];
    }
    const normalizedQuery = inlineMenu.query.trim().toLowerCase();
    const filtered = availableAttachmentOptions.filter((option) =>
      normalizedQuery ? option.toLowerCase().includes(normalizedQuery) : true,
    );
    return filtered.slice(0, 6);
  }, [availableAttachmentOptions, inlineMenu]);
  const inlineCommandOptions = useMemo(() => {
    if (inlineMenu?.type !== "command") {
      return [];
    }
    const normalizedQuery = inlineMenu.query.trim().toLowerCase();
    const filtered = commandOptions.filter((option) => {
      if (!normalizedQuery) return true;
      return (
        option.id.includes(normalizedQuery) ||
        option.label.toLowerCase().includes(normalizedQuery) ||
        option.description.toLowerCase().includes(normalizedQuery)
      );
    });
    return filtered.slice(0, 6);
  }, [inlineMenu]);
  const activeInlineOptions = inlineMenu
    ? inlineMenu.type === "file"
      ? inlineFileOptions
      : inlineCommandOptions
    : [];

  useEffect(() => {
    if (!activeInlineOptions.length) {
      setInlineSelectionIndex(0);
      return;
    }
    setInlineSelectionIndex((current) =>
      current >= activeInlineOptions.length ? 0 : current,
    );
  }, [activeInlineOptions.length, inlineMenu?.tokenStart, inlineMenu?.type]);
  const selectedInlineFile =
    inlineMenu?.type === "file"
      ? inlineFileOptions[inlineSelectionIndex]
      : null;
  const selectedInlineCommand =
    inlineMenu?.type === "command"
      ? inlineCommandOptions[inlineSelectionIndex]
      : null;

  const applyActiveInlineSelection = () => {
    if (!inlineMenu) {
      return;
    }
    if (inlineMenu.type === "file") {
      if (!selectedInlineFile) {
        return;
      }
      applyInlineSelection(selectedInlineFile);
      return;
    }
    if (!selectedInlineCommand) {
      return;
    }
    applyInlineSelection(selectedInlineCommand.id);
  };
  const { status: gitStatus } = useWorkspaceGitStatus(resolvedWorkspacePath);
  const { branches } = useWorkspaceBranches(resolvedWorkspacePath);
  const branchLabel = gitStatus?.branch ?? "main";
  const checkoutMutation = useMutation({
    mutationFn: async (branch: string) => {
      if (!resolvedWorkspacePath) {
        throw new Error("Select a workspace before changing branch.");
      }
      await checkoutBranch(resolvedWorkspacePath, branch);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["git", "status", resolvedWorkspacePath],
        }),
        queryClient.invalidateQueries({
          queryKey: ["git", "branches", resolvedWorkspacePath],
        }),
        queryClient.invalidateQueries({
          queryKey: ["git", "diff", resolvedWorkspacePath],
        }),
      ]);
    },
  });

  const handleModeChange = (option: typeof environmentMode) => {
    if (isContextLocked) {
      setError("Unlock the composer controls to change environment.");
      return;
    }
    setEnvironmentMode(option);
    if (option === "worktree") {
      setActiveModal("worktree");
    }
  };

  const setComposerPrompt = (value: string, cursorPosition?: number | null) => {
    setComposerDraft(value);
    const resolvedCursor =
      cursorPosition ?? composerRef.current?.selectionStart ?? value.length;
    const beforeCursor = value.slice(0, resolvedCursor);
    const match = beforeCursor.match(/(?:^|\s)([@/])([^\s@/]*)$/);
    if (!match) {
      setInlineMenu(null);
      return;
    }

    const tokenPrefix = match[1];
    const query = match[2] ?? "";
    const tokenStart = resolvedCursor - query.length - 1;
    if (tokenStart < 0) {
      setInlineMenu(null);
      return;
    }

    setInlineMenu({
      type: tokenPrefix === "@" ? "file" : "command",
      query,
      tokenStart,
      tokenEnd: resolvedCursor,
    });
    setInlineSelectionIndex(0);
  };

  const addAttachment = (path: string) => {
    setSelectedAttachments((current) => {
      if (current.includes(path)) {
        return current;
      }
      return [...current, path];
    });
  };

  const removeAttachment = (path: string) => {
    setSelectedAttachments((current) =>
      current.filter((attachment) => attachment !== path),
    );
  };

  const applyInlineFileSelection = (value: string) => {
    if (!inlineMenu) {
      return;
    }
    const menuState = inlineMenu;
    const replacement = `@${value} `;
    const nextPrompt = `${composerDraft.slice(0, menuState.tokenStart)}${replacement}${composerDraft.slice(menuState.tokenEnd)}`;
    setComposerDraft(nextPrompt);
    setInlineMenu(null);
    addAttachment(value);

    const nextCursor = menuState.tokenStart + replacement.length;
    window.requestAnimationFrame(() => {
      const textarea = composerRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const submitPrompt = async (
    prompt: string,
    attachments: string[] = [],
    clearComposerAfterSubmit = true,
  ) => {
    if (!isTauri()) {
      throw new Error("Runs are available in the desktop app.");
    }
    if (!resolvedWorkspacePath) {
      setWorkspacePickerOpen(true);
      throw new Error("Select a workspace before starting a run.");
    }

    const cwd = resolvedWorkspacePath ?? undefined;
    let targetThreadId: string | undefined = threadId;
    const shouldStartNewThread =
      !targetThreadId ||
      runtimeSettings.followUpBehavior === "new-thread" ||
      (runtimeSettings.followUpBehavior === "ask" &&
        window.confirm(
          "Start a new thread for this prompt? Click Cancel to append in the current thread.",
        ));

    if (shouldStartNewThread) {
      const newThread = await startThread({ cwd });
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
    if (!shouldStartNewThread) {
      await resumeThread({ threadId: targetThreadId });
    }

    const attachmentContext = attachments.length
      ? `\n\nAttached files:\n${attachments.map((path) => `- ${path}`).join("\n")}`
      : "";
    const turnInput = `${prompt}${attachmentContext}`;
    await startTurn({
      threadId: targetThreadId,
      input: turnInput,
      cwd,
      effort: effortFromQuality[qualityPreset],
    });
    onSubmitted?.(turnInput);

    if (clearComposerAfterSubmit) {
      setComposerDraft("");
      setSelectedAttachments([]);
      setInlineMenu(null);
    }
  };

  const runComposerCommand = async (commandId: CommandOptionId) => {
    setInlineMenu(null);
    setError(null);
    const commandPrompts: Record<CommandOptionId, string> = {
      summarize:
        "Summarize the current workspace changes and call out any risks.",
      tests:
        "Run the most relevant test commands for the current changes and report failures.",
      review:
        "Review the current code changes and list bugs, regressions, and missing tests.",
      plan: "Update docs/custom/plan.md with current progress and remaining work.",
    };
    if (commandId === "review") {
      setReviewOpen(true);
    }

    setIsSubmitting(true);
    try {
      await submitPrompt(commandPrompts[commandId], []);
    } catch (commandError) {
      setError(
        commandError instanceof Error
          ? commandError.message
          : "Failed to run command.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyInlineSelection = (value: string) => {
    if (!inlineMenu) {
      return;
    }
    if (inlineMenu.type === "file") {
      applyInlineFileSelection(value);
      return;
    }
    void runComposerCommand(value as CommandOptionId);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }
    const trimmedPrompt = composerDraft.trim();
    if (!trimmedPrompt) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await submitPrompt(trimmedPrompt, selectedAttachments);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to start run.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStop = async () => {
    if (isSubmitting && !isRunning) {
      setIsSubmitting(false);
      return;
    }
    if (!threadId) {
      setError("No active thread to cancel.");
      return;
    }

    const activeTurnId = getActiveRun(threadId)?.turnId ?? null;
    setIsStopping(true);
    setError(null);
    try {
      await cancelTurn({ threadId, turnId: activeTurnId });
      clearActiveRun(threadId);
      await queryClient.invalidateQueries({
        queryKey: ["threads", "read", threadId],
      });
    } catch (stopError) {
      setError(
        stopError instanceof Error
          ? stopError.message
          : "Failed to cancel active run.",
      );
    } finally {
      setIsStopping(false);
    }
  };

  useEffect(() => {
    if (!branchMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (branchMenuRef.current?.contains(event.target as Node)) return;
      setBranchMenuOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [branchMenuOpen]);

  const handleBranchSelect = async (branch: string) => {
    if (isContextLocked) {
      setBranchError("Unlock the composer controls to change branch.");
      return;
    }
    setBranchError(null);
    try {
      await checkoutMutation.mutateAsync(branch);
      setBranchMenuOpen(false);
    } catch (checkoutError) {
      setBranchError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Failed to switch branch.",
      );
    }
  };

  const progressPercent = runProgress.percent || (isSubmitting ? 5 : 0);
  const showProgress = isRunning || isSubmitting;
  const isCompactComposer = runtimeSettings.compactComposer;
  const workspaceLabel = resolvedWorkspacePath
    ? workspaceNameFromPath(resolvedWorkspacePath)
    : "Add workspace";

  return (
    <div className="space-y-3">
      <div className="rounded-[24px] border border-white/10 bg-[#090f1d]/88 p-4 shadow-[0_12px_34px_rgba(2,6,18,0.45)]">
        {selectedAttachments.length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedAttachments.map((attachment) => (
              <button
                key={attachment}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs text-ink-200 hover:border-flare-300"
                onClick={() => removeAttachment(attachment)}
                title={`Remove ${attachment}`}
              >
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[220px] truncate">{attachment}</span>
                <span className="text-ink-500">×</span>
              </button>
            ))}
          </div>
        ) : null}
        <textarea
          ref={composerRef}
          className={`w-full resize-none bg-transparent p-2 text-base text-ink-100 placeholder:text-ink-500/80 focus:outline-none ${
            isCompactComposer ? "h-20" : "h-28"
          }`}
          placeholder={
            placeholder ?? "Ask Codex anything, @ to add files, / for commands"
          }
          value={composerDraft}
          onChange={(event) =>
            setComposerPrompt(event.target.value, event.target.selectionStart)
          }
          onClick={(event) =>
            setComposerPrompt(composerDraft, event.currentTarget.selectionStart)
          }
          onKeyUp={(event) =>
            setComposerPrompt(composerDraft, event.currentTarget.selectionStart)
          }
          onKeyDown={(event) => {
            if (inlineMenu) {
              if (event.key === "Escape") {
                event.preventDefault();
                setInlineMenu(null);
                return;
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                if (!activeInlineOptions.length) {
                  return;
                }
                setInlineSelectionIndex(
                  (current) => (current + 1) % activeInlineOptions.length,
                );
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                if (!activeInlineOptions.length) {
                  return;
                }
                setInlineSelectionIndex(
                  (current) =>
                    (current - 1 + activeInlineOptions.length) %
                    activeInlineOptions.length,
                );
                return;
              }
              if (event.key === "Tab") {
                event.preventDefault();
                if (!activeInlineOptions.length) {
                  return;
                }
                if (event.shiftKey) {
                  setInlineSelectionIndex(
                    (current) =>
                      (current - 1 + activeInlineOptions.length) %
                      activeInlineOptions.length,
                  );
                } else {
                  setInlineSelectionIndex(
                    (current) => (current + 1) % activeInlineOptions.length,
                  );
                }
                return;
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                applyActiveInlineSelection();
                return;
              }
            }
            if (event.key !== "Enter" || event.shiftKey) {
              return;
            }
            event.preventDefault();
            void handleSubmit();
          }}
        />
        {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
        {inlineMenu && inlineMenu.type === "file" ? (
          <div className="surface-panel mt-2 p-2 text-xs">
            <p className="px-2 pb-1 text-[0.65rem] uppercase tracking-[0.2em] text-ink-500">
              Attach file
            </p>
            {indexingFiles ? (
              <p className="px-3 py-2 text-[0.65rem] text-ink-500">
                Indexing workspace files…
              </p>
            ) : inlineFileOptions.length ? (
              inlineFileOptions.map((option, optionIndex) => (
                <button
                  key={option}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-ink-200 ${
                    optionIndex === inlineSelectionIndex
                      ? "bg-flare-400/10 text-ink-50"
                      : "hover:bg-white/5"
                  }`}
                  onClick={() => applyInlineSelection(option)}
                >
                  <span className="truncate">{option}</span>
                  <span className="text-[0.65rem] text-ink-500">@</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-[0.65rem] text-ink-500">
                No files match this query.
              </p>
            )}
          </div>
        ) : null}
        {inlineMenu && inlineMenu.type === "command" ? (
          <div className="surface-panel mt-2 p-2 text-xs">
            <p className="px-2 pb-1 text-[0.65rem] uppercase tracking-[0.2em] text-ink-500">
              Commands
            </p>
            {inlineCommandOptions.length ? (
              inlineCommandOptions.map((option, optionIndex) => (
                <button
                  key={option.id}
                  className={`w-full rounded-xl px-3 py-2 text-left ${
                    optionIndex === inlineSelectionIndex
                      ? "bg-flare-400/10"
                      : "hover:bg-white/5"
                  }`}
                  onClick={() => applyInlineSelection(option.id)}
                >
                  <p className="text-ink-100">/{option.id}</p>
                  <p className="text-[0.65rem] text-ink-500">
                    {option.description}
                  </p>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-[0.65rem] text-ink-500">
                No commands match this query.
              </p>
            )}
          </div>
        ) : null}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 text-xs ${
            isCompactComposer ? "mt-2" : "mt-3"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={`rounded-full border p-2 transition ${
                attachmentsDrawerOpen
                  ? "border-flare-300 bg-flare-400/14 text-ink-50"
                  : "border-white/10 bg-black/25 hover:border-flare-300"
              }`}
              onClick={() => setAttachmentsDrawerOpen((open) => !open)}
              aria-label={
                attachmentsDrawerOpen
                  ? "Close attachment picker"
                  : "Open attachment picker"
              }
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <select
              className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs text-ink-100"
              value={activeModel}
              onChange={(event) => setActiveModel(event.target.value)}
            >
              {modelOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs text-ink-100"
              value={qualityPreset}
              onChange={(event) =>
                setQualityPreset(event.target.value as QualityPreset)
              }
            >
              {Object.entries(qualityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`rounded-full border p-2 transition ${
                isContextLocked
                  ? "border-flare-300 bg-flare-400/10 text-ink-50"
                  : "border-white/10 bg-black/25 text-ink-300 hover:border-flare-300"
              }`}
              onClick={() => {
                setIsContextLocked((locked) => !locked);
                setError(null);
              }}
              title={
                isContextLocked
                  ? "Unlock composer controls"
                  : "Lock composer controls"
              }
              aria-label={
                isContextLocked
                  ? "Unlock composer controls"
                  : "Lock composer controls"
              }
            >
              <Lock className="h-3.5 w-3.5" />
            </button>
            <button
              className={`flex items-center justify-center rounded-full border border-flare-300 bg-flare-400/20 text-ink-50 shadow-glow disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-black/25 disabled:text-ink-400 ${
                isCompactComposer ? "h-9 w-9" : "h-10 w-10"
              }`}
              onClick={() => {
                if (isBusy) {
                  void handleStop();
                  return;
                }
                void handleSubmit();
              }}
              disabled={!canSubmit && !isBusy}
            >
              {isBusy ? (
                <Square className="h-4 w-4" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
        {attachmentsDrawerOpen ? (
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/35 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-ink-500">
                Attachment picker
              </p>
              <button
                className="rounded-full border border-white/10 px-2 py-1 text-[0.65rem] text-ink-300 hover:border-flare-300"
                onClick={() => setAttachmentsDrawerOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="codex-scrollbar mt-2 max-h-40 space-y-1 overflow-auto">
              {availableAttachmentOptions.map((option) => {
                const attached = selectedAttachments.includes(option);
                return (
                  <button
                    key={option}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${
                      attached
                        ? "border border-flare-300 bg-flare-400/10 text-ink-50"
                        : "border border-transparent text-ink-200 hover:border-white/10 hover:bg-white/5"
                    }`}
                    onClick={() => {
                      if (attached) {
                        removeAttachment(option);
                      } else {
                        addAttachment(option);
                      }
                    }}
                  >
                    <span className="truncate">{option}</span>
                    <span className="text-[0.65rem] text-ink-500">
                      {attached ? "Attached" : "Attach"}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[0.65rem] text-ink-500">
              Tip: type <span className="text-ink-300">@</span> in the composer
              to filter and attach files inline.
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-300">
        <div className="flex items-center gap-2">
          {environmentModes.map((option) => (
            <button
              key={option}
              className={`rounded-full border px-3 py-1 text-xs capitalize hover:border-flare-300 ${
                environmentMode === option
                  ? "border-flare-300 bg-flare-400/10 text-ink-50"
                  : "border-white/10 text-ink-300"
              }`}
              onClick={() => handleModeChange(option)}
              disabled={isContextLocked}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
            onClick={() => {
              if (isContextLocked) {
                setError("Unlock the composer controls to change workspace.");
                return;
              }
              setWorkspacePickerOpen(true);
            }}
            disabled={isContextLocked}
          >
            <Settings className="h-3.5 w-3.5" />
            {workspaceLabel}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <div className="relative" ref={branchMenuRef}>
            <button
              className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
              onClick={() => setBranchMenuOpen((open) => !open)}
              disabled={isContextLocked}
            >
              <GitBranch className="h-3.5 w-3.5" />
              From {branchLabel}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {branchMenuOpen ? (
              <div className="surface-panel absolute right-0 mt-2 w-56 p-2 text-[0.7rem] text-ink-200">
                {branches.length ? (
                  branches.map((branch) => (
                    <button
                      key={branch}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-white/5 ${
                        branch === branchLabel ? "text-ink-50" : "text-ink-300"
                      }`}
                      onClick={() => {
                        void handleBranchSelect(branch);
                      }}
                      disabled={checkoutMutation.isPending}
                    >
                      <span className="truncate">{branch}</span>
                      {branch === branchLabel ? (
                        <span className="text-[0.65rem] text-emerald-300">
                          current
                        </span>
                      ) : null}
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-[0.65rem] text-ink-500">
                    No branches available.
                  </p>
                )}
                {branchError ? (
                  <p className="px-3 py-2 text-[0.65rem] text-rose-300">
                    {branchError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {showProgress ? (
        <div className="flex items-center justify-end gap-3 text-xs text-ink-300">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(#ff9b4a 0% ${progressPercent}%, rgba(255,255,255,0.08) ${progressPercent}% 100%)`,
            }}
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-900 text-[0.6rem] text-ink-100">
              {progressPercent}%
            </div>
          </div>
          <span className="max-w-[160px] truncate">
            {environmentMode === "worktree" ? "worktree/main" : "main"}
          </span>
        </div>
      ) : null}
    </div>
  );
}
