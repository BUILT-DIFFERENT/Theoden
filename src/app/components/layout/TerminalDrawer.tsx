import { useMatchRoute } from "@tanstack/react-router";
import { Check, Copy, Loader2, Terminal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  clearTerminalSession,
  runTerminalCommand,
  sessionOutputText,
} from "@/app/services/cli/terminalSessions";
import { useTerminalSession } from "@/app/services/cli/useTerminalSession";
import { useThreadDetail } from "@/app/services/cli/useThreadDetail";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import { workspaceNameFromPath } from "@/app/utils/workspace";

interface TerminalDrawerProps {
  isOpen: boolean;
}

export function TerminalDrawer({ isOpen }: TerminalDrawerProps) {
  const matchRoute = useMatchRoute();
  const threadMatch = matchRoute({ to: "/t/$threadId" });
  const threadId = threadMatch ? threadMatch.threadId : undefined;
  const { thread } = useThreadDetail(threadId);
  const { workspaces } = useWorkspaces();
  const { selectedWorkspace } = useWorkspaceUi();
  const outputRef = useRef<HTMLDivElement | null>(null);
  const [commandInput, setCommandInput] = useState("");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);

  const resolvedWorkspacePath =
    thread?.subtitle ?? selectedWorkspace ?? workspaces[0]?.path ?? null;
  const scope = useMemo(
    () => ({
      threadId,
      workspacePath: resolvedWorkspacePath,
    }),
    [resolvedWorkspacePath, threadId],
  );
  const session = useTerminalSession(scope);
  const sessionLabel = threadId
    ? `Thread ${threadId.slice(0, 8)}`
    : resolvedWorkspacePath
      ? workspaceNameFromPath(resolvedWorkspacePath)
      : "No workspace";

  useEffect(() => {
    if (!copyMessage) {
      return;
    }
    const timeoutId = window.setTimeout(() => setCopyMessage(null), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copyMessage]);

  useEffect(() => {
    const container = outputRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [session.entries.length]);

  if (!isOpen) {
    return null;
  }

  const handleRun = async () => {
    if (!commandInput.trim()) {
      return;
    }
    setCommandError(null);
    const command = commandInput.trim();
    setCommandInput("");
    try {
      await runTerminalCommand(scope, command);
    } catch (error) {
      setCommandError(
        error instanceof Error ? error.message : "Terminal command failed.",
      );
    }
  };

  const handleClear = () => {
    void clearTerminalSession(scope);
    setCommandError(null);
  };

  const handleCopy = async () => {
    const selectedText = window.getSelection()?.toString().trim();
    const text =
      selectedText && selectedText.length
        ? selectedText
        : sessionOutputText(scope).trim();
    if (!text.length) {
      setCopyMessage("Nothing to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage(selectedText ? "Selection copied." : "Output copied.");
    } catch (error) {
      console.warn("Failed to copy terminal output", error);
      setCopyMessage("Copy failed.");
    }
  };

  return (
    <section className="border-t border-white/10 bg-ink-900/70 px-6 py-4">
      <div className="surface-panel">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2 text-xs text-ink-300">
          <div className="flex min-w-0 items-center gap-2">
            <Terminal className="h-3.5 w-3.5" />
            <span>Terminal</span>
            <span className="truncate text-[0.65rem] text-ink-500">
              {sessionLabel}
            </span>
            {session.isRunning ? (
              <span className="inline-flex items-center gap-1 text-[0.65rem] text-ink-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Running
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[0.65rem] hover:border-flare-300"
              onClick={() => {
                void handleCopy();
              }}
            >
              {copyMessage ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copyMessage ?? "Copy selection"}
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[0.65rem] hover:border-flare-300"
              onClick={handleClear}
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          </div>
        </div>
        <div
          ref={outputRef}
          className="codex-scrollbar max-h-44 space-y-1 overflow-auto px-4 py-3 font-mono text-[0.7rem] text-ink-300"
        >
          {session.entries.length ? (
            session.entries.map((entry) => (
              <p
                key={entry.id}
                className={
                  entry.kind === "stderr"
                    ? "whitespace-pre-wrap text-rose-300"
                    : entry.kind === "input"
                      ? "whitespace-pre-wrap text-ink-500"
                      : entry.kind === "system"
                        ? "whitespace-pre-wrap text-ink-500"
                        : "whitespace-pre-wrap"
                }
              >
                {entry.text}
              </p>
            ))
          ) : (
            <p className="text-ink-500">
              Run a command here or execute tasks in-thread to stream command
              output.
            </p>
          )}
        </div>
        <div className="border-t border-white/10 px-4 py-3">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-[0.75rem] text-ink-300">
            <span className="text-ink-500">$</span>
            <input
              className="w-full bg-transparent text-ink-100 placeholder:text-ink-500 focus:outline-none"
              placeholder={
                resolvedWorkspacePath
                  ? "Type a command and press Enter"
                  : "Select a workspace and run a command"
              }
              value={commandInput}
              onChange={(event) => setCommandInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey) {
                  return;
                }
                event.preventDefault();
                void handleRun();
              }}
              disabled={session.isRunning}
            />
          </label>
          {commandError ? (
            <p className="mt-2 text-xs text-rose-300">{commandError}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
