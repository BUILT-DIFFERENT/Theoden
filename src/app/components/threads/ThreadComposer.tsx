import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowUp,
  ChevronDown,
  GitBranch,
  Lock,
  Plus,
  Settings,
  Square,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { resumeThread, startThread, startTurn } from "@/app/services/cli/turns";
import { useRunProgress } from "@/app/services/cli/useRunProgress";
import { useThreadDetail } from "@/app/services/cli/useThreadDetail";
import { useThreadUi } from "@/app/state/threadUi";
import { isTauri } from "@/app/utils/tauri";

type ComposerMode = "local" | "worktree" | "cloud";
type EffortLevel = "medium" | "high" | "xhigh";

const effortLabels: Record<EffortLevel, string> = {
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
};

const modelOptions = ["GPT-5.2-Codex", "GPT-5", "o4-mini"] as const;
const agentOptions = ["Default", "Review", "Docs"] as const;

interface ThreadComposerProps {
  prefillPrompt?: string;
  workspaceName?: string;
}

export function ThreadComposer({
  prefillPrompt,
  workspaceName,
}: ThreadComposerProps) {
  const matchRoute = useMatchRoute();
  const threadMatch = matchRoute({ to: "/threads/$threadId" });
  const threadId = threadMatch ? threadMatch.threadId : undefined;
  const navigate = useNavigate();
  const { thread: threadDetail } = useThreadDetail(threadId);
  const thread = threadId ? threadDetail : undefined;
  const runProgress = useRunProgress(threadId);
  const { setActiveModal } = useThreadUi();
  const [prompt, setPrompt] = useState(prefillPrompt ?? "");
  const [mode, setMode] = useState<ComposerMode>(thread?.mode ?? "local");
  const [effort, setEffort] = useState<EffortLevel>("high");
  const [model, setModel] =
    useState<(typeof modelOptions)[number]>("GPT-5.2-Codex");
  const [agent, setAgent] = useState<(typeof agentOptions)[number]>("Default");
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

  const isRunning = runProgress.isActive;
  const isBusy = isSubmitting || isRunning;
  const canSubmit = useMemo(() => {
    return !isBusy && prompt.trim().length > 0;
  }, [isBusy, prompt]);

  const handleModeChange = (option: ComposerMode) => {
    setMode(option);
    if (option === "worktree") {
      setActiveModal("worktree");
    }
  };

  const handleSubmit = async () => {
    if (!isTauri()) return;
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const cwd = thread?.subtitle ?? workspaceName ?? undefined;
      let targetThreadId: string | undefined = threadId;
      if (!targetThreadId) {
        const newThread = await startThread({ cwd });
        targetThreadId = newThread?.id;
        if (targetThreadId) {
          await navigate({
            to: "/threads/$threadId",
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
      await startTurn({
        threadId: targetThreadId,
        input: prompt.trim(),
        cwd,
        effort,
      });
      setPrompt("");
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
  const workspaceLabel = workspaceName ?? thread?.subtitle ?? "photobooth";
  const branchLabel = mode === "worktree" ? "From main" : "From main";

  return (
    <div className="space-y-3">
      <div className="rounded-3xl border border-white/10 bg-ink-900/70 p-4 shadow-card">
        <textarea
          className="h-28 w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-ink-100 focus:outline-none"
          placeholder="Type your request (use @ to attach files or / for commands)"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded-full border border-white/10 p-2 hover:border-flare-300">
              <Plus className="h-3.5 w-3.5" />
            </button>
            <select
              className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-ink-100"
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
              className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-ink-100"
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
              className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-ink-100"
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
          <button className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">
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
