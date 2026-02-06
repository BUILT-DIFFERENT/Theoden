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

import { resumeThread, startThread, startTurn } from "@/app/services/cli/turns";
import { useRunProgress } from "@/app/services/cli/useRunProgress";
import { useThreadDetail } from "@/app/services/cli/useThreadDetail";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { useThreadUi } from "@/app/state/threadUi";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import { isTauri } from "@/app/utils/tauri";
import { workspaceNameFromPath } from "@/app/utils/workspace";

type ComposerMode = "local" | "worktree" | "cloud";
type EffortLevel = "medium" | "high" | "xhigh";

const effortLabels: Record<EffortLevel, string> = {
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
};

const modelOptions = ["GPT-5.2-Codex", "GPT-5", "o4-mini"] as const;
const agentOptions = ["Default", "Review", "Docs"] as const;
const fallbackAttachmentOptions = [
  "src/app/components/threads/ThreadComposer.tsx",
  "src/app/routes/ThreadPage.tsx",
  "src/app/components/diff/DiffPanel.tsx",
  "docs/custom/plan.md",
  "package.json",
] as const;
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
  const { setActiveModal } = useThreadUi();
  const { workspaces } = useWorkspaces();
  const { selectedWorkspace, setSelectedWorkspace, setWorkspacePickerOpen } =
    useWorkspaceUi();
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [prompt, setPrompt] = useState(prefillPrompt ?? "");
  const [mode, setMode] = useState<ComposerMode>(thread?.mode ?? "local");
  const [effort, setEffort] = useState<EffortLevel>("high");
  const [model, setModel] =
    useState<(typeof modelOptions)[number]>("GPT-5.2-Codex");
  const [agent, setAgent] = useState<(typeof agentOptions)[number]>("Default");
  const [attachmentsDrawerOpen, setAttachmentsDrawerOpen] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);
  const [inlineMenu, setInlineMenu] = useState<InlineMenuState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (prefillPrompt) {
      setPrompt(prefillPrompt);
    }
  }, [prefillPrompt]);

  useEffect(() => {
    if (thread?.mode) {
      setMode(thread.mode);
    }
  }, [thread?.mode]);
  useEffect(() => {
    if (selectedWorkspace) return;
    if (!workspaces.length) return;
    setSelectedWorkspace(workspaces[0].path);
  }, [selectedWorkspace, setSelectedWorkspace, workspaces]);

  const isRunning = runProgress.isActive;
  const isBusy = isSubmitting || isRunning;
  const resolvedWorkspacePath =
    thread?.subtitle ??
    selectedWorkspace ??
    workspaces[0]?.path ??
    workspaceName ??
    null;
  const canSubmit = useMemo(() => {
    return (
      !isBusy && prompt.trim().length > 0 && Boolean(resolvedWorkspacePath)
    );
  }, [isBusy, prompt, resolvedWorkspacePath]);
  const availableAttachmentOptions = useMemo(() => {
    const options = new Set<string>();
    thread?.attachments.forEach((attachment) => options.add(attachment.path));
    thread?.diffSummary.files.forEach((file) => options.add(file.path));
    fallbackAttachmentOptions.forEach((path) => options.add(path));
    return Array.from(options);
  }, [thread?.attachments, thread?.diffSummary.files]);
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

  const handleModeChange = (option: ComposerMode) => {
    setMode(option);
    if (option === "worktree") {
      setActiveModal("worktree");
    }
  };

  const setComposerPrompt = (value: string, cursorPosition?: number | null) => {
    setPrompt(value);
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

  const applyInlineSelection = (value: string) => {
    if (!inlineMenu) {
      return;
    }
    const menuState = inlineMenu;
    const replacement = menuState.type === "file" ? `@${value} ` : `/${value} `;
    const nextPrompt = `${prompt.slice(0, menuState.tokenStart)}${replacement}${prompt.slice(menuState.tokenEnd)}`;
    setPrompt(nextPrompt);
    setInlineMenu(null);
    if (menuState.type === "file") {
      addAttachment(value);
    }

    const nextCursor = menuState.tokenStart + replacement.length;
    window.requestAnimationFrame(() => {
      const textarea = composerRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleSubmit = async () => {
    if (!isTauri()) return;
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      if (!resolvedWorkspacePath) {
        setWorkspacePickerOpen(true);
        throw new Error("Select a workspace before starting a run.");
      }
      const cwd = resolvedWorkspacePath ?? undefined;
      let targetThreadId: string | undefined = threadId;
      if (!targetThreadId) {
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
      if (threadId) {
        await resumeThread({ threadId });
      }
      const trimmedPrompt = prompt.trim();
      const attachmentContext = selectedAttachments.length
        ? `\n\nAttached files:\n${selectedAttachments.map((path) => `- ${path}`).join("\n")}`
        : "";
      const turnInput = `${trimmedPrompt}${attachmentContext}`;
      await startTurn({
        threadId: targetThreadId,
        input: turnInput,
        cwd,
        effort,
      });
      onSubmitted?.(turnInput);
      setPrompt("");
      setSelectedAttachments([]);
      setInlineMenu(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start run.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStop = () => {
    setIsSubmitting(false);
  };

  const progressPercent = runProgress.percent || (isSubmitting ? 5 : 0);
  const showProgress = isRunning || isSubmitting;
  const workspaceLabel = resolvedWorkspacePath
    ? workspaceNameFromPath(resolvedWorkspacePath)
    : "Add workspace";
  const branchLabel = mode === "worktree" ? "From main" : "From main";

  return (
    <div className="space-y-3">
      <div className="rounded-[28px] bg-black/25 p-4 backdrop-blur-xl ring-1 ring-white/10">
        {selectedAttachments.length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedAttachments.map((attachment) => (
              <button
                key={attachment}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-ink-200 hover:border-flare-300"
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
          className="h-28 w-full resize-none bg-transparent p-2 text-base text-ink-100 placeholder:text-ink-500 focus:outline-none"
          placeholder={
            placeholder ?? "Ask Codex anything, @ to add files, / for commands"
          }
          value={prompt}
          onChange={(event) =>
            setComposerPrompt(event.target.value, event.target.selectionStart)
          }
          onClick={(event) =>
            setComposerPrompt(prompt, event.currentTarget.selectionStart)
          }
          onKeyUp={(event) =>
            setComposerPrompt(prompt, event.currentTarget.selectionStart)
          }
          onKeyDown={(event) => {
            if (event.key === "Escape" && inlineMenu) {
              event.preventDefault();
              setInlineMenu(null);
              return;
            }
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              inlineMenu &&
              (inlineFileOptions.length || inlineCommandOptions.length)
            ) {
              event.preventDefault();
              if (inlineMenu.type === "file" && inlineFileOptions.length) {
                applyInlineSelection(inlineFileOptions[0]);
                return;
              }
              if (
                inlineMenu.type === "command" &&
                inlineCommandOptions.length
              ) {
                applyInlineSelection(inlineCommandOptions[0].id);
                return;
              }
            }
            if (event.key !== "Enter" || event.shiftKey) return;
            event.preventDefault();
            void handleSubmit();
          }}
        />
        {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
        {inlineMenu &&
        inlineMenu.type === "file" &&
        inlineFileOptions.length ? (
          <div className="mt-2 rounded-2xl border border-white/10 bg-ink-900/95 p-2 text-xs shadow-card">
            <p className="px-2 pb-1 text-[0.65rem] uppercase tracking-[0.2em] text-ink-500">
              Attach file
            </p>
            {inlineFileOptions.map((option) => (
              <button
                key={option}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-ink-200 hover:bg-white/5"
                onClick={() => applyInlineSelection(option)}
              >
                <span className="truncate">{option}</span>
                <span className="text-[0.65rem] text-ink-500">@</span>
              </button>
            ))}
          </div>
        ) : null}
        {inlineMenu &&
        inlineMenu.type === "command" &&
        inlineCommandOptions.length ? (
          <div className="mt-2 rounded-2xl border border-white/10 bg-ink-900/95 p-2 text-xs shadow-card">
            <p className="px-2 pb-1 text-[0.65rem] uppercase tracking-[0.2em] text-ink-500">
              Commands
            </p>
            {inlineCommandOptions.map((option) => (
              <button
                key={option.id}
                className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5"
                onClick={() => applyInlineSelection(option.id)}
              >
                <p className="text-ink-100">/{option.id}</p>
                <p className="text-[0.65rem] text-ink-500">
                  {option.description}
                </p>
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={`rounded-full border p-2 transition ${
                attachmentsDrawerOpen
                  ? "border-flare-300 bg-flare-400/10 text-ink-50"
                  : "border-white/10 hover:border-flare-300"
              }`}
              onClick={() => setAttachmentsDrawerOpen((open) => !open)}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <select
              className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-ink-100"
              value={agent}
              onChange={(event) =>
                setAgent(event.target.value as (typeof agentOptions)[number])
              }
            >
              {agentOptions.map((option) => (
                <option key={option} value={option}>
                  Agent: {option}
                </option>
              ))}
            </select>
            <select
              className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-ink-100"
              value={model}
              onChange={(event) =>
                setModel(event.target.value as (typeof modelOptions)[number])
              }
            >
              {modelOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-ink-100"
              value={effort}
              onChange={(event) => setEffort(event.target.value as EffortLevel)}
            >
              {Object.entries(effortLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-full border border-white/10 p-2 text-ink-300 hover:border-flare-300">
              <Lock className="h-3.5 w-3.5" />
            </button>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full border border-flare-300 bg-flare-400/20 text-ink-50 shadow-glow disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-black/20 disabled:text-ink-400"
              onClick={() => (isBusy ? handleStop() : void handleSubmit())}
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
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
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
            <div className="mt-2 max-h-40 space-y-1 overflow-auto">
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
          {("local worktree cloud" as const).split(" ").map((option) => (
            <button
              key={option}
              className={`rounded-full border px-3 py-1 text-xs capitalize hover:border-flare-300 ${
                mode === option
                  ? "border-flare-300 bg-flare-400/10 text-ink-50"
                  : "border-white/10 text-ink-300"
              }`}
              onClick={() => handleModeChange(option as ComposerMode)}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
            onClick={() => setWorkspacePickerOpen(true)}
          >
            <Settings className="h-3.5 w-3.5" />
            {workspaceLabel}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">
            <GitBranch className="h-3.5 w-3.5" />
            {branchLabel}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
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
            {mode === "worktree" ? "worktree/main" : "main"}
          </span>
        </div>
      ) : null}
    </div>
  );
}
