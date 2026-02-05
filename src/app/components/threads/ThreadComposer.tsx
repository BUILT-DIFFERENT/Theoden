import { useNavigate, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { resumeThread, startThread, startTurn } from "@/app/services/cli/turns";
import { useThreadDetail } from "@/app/services/cli/useThreadDetail";
import { isTauri } from "@/app/utils/tauri";

type ComposerMode = "local" | "worktree" | "cloud";
type EffortLevel = "medium" | "high" | "xhigh";

const effortLabels: Record<EffortLevel, string> = {
  medium: "Medium",
  high: "High",
  xhigh: "Extra High",
};

export function ThreadComposer() {
  const { threadId } = useParams({ from: "/threads/$threadId" });
  const navigate = useNavigate();
  const { thread } = useThreadDetail(threadId);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<ComposerMode>("local");
  const [effort, setEffort] = useState<EffortLevel>("high");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDisabled = useMemo(() => {
    return isSubmitting || prompt.trim().length === 0;
  }, [isSubmitting, prompt]);

  const handleSubmit = async () => {
    if (!isTauri()) return;
    if (isDisabled) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const cwd = thread?.subtitle ?? undefined;
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

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
            New instruction
          </p>
          <p className="text-sm text-ink-200">
            Launch a new run or append to the thread
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          {(["local", "worktree", "cloud"] as ComposerMode[]).map((option) => (
            <button
              key={option}
              className={`rounded-full border px-3 py-1 hover:border-flare-300 ${
                mode === option
                  ? "border-flare-300 bg-flare-400/10 text-ink-50"
                  : "border-white/10 text-ink-300"
              }`}
              onClick={() => setMode(option)}
            >
              {option[0].toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <textarea
        className="mt-3 h-28 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-ink-100 focus:outline-none"
        placeholder="Describe the outcome you want: fix timestamp bug, add automation, generate PR..."
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
      />
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">
            Attach image
          </button>
          <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">
            Choose skill
          </button>
          {mode !== "local" ? (
            <span className="rounded-full border border-white/10 px-3 py-1 text-[0.65rem] text-ink-400">
              {mode} mode wired soon
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-ink-400">Effort</span>
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
          <button
            className="rounded-full border border-flare-300 bg-flare-400/20 px-4 py-1 text-xs text-ink-50 shadow-glow disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-black/20 disabled:text-ink-400"
            onClick={() => void handleSubmit()}
            disabled={isDisabled}
          >
            {isSubmitting ? "Starting…" : "Start run"}
          </button>
        </div>
      </div>
    </div>
  );
}
