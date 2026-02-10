import { useMatchRoute } from "@tanstack/react-router";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import { Check, Copy, Loader2, Terminal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  clearTerminalSession,
  resizeTerminalViewport,
  runTerminalCommand,
  sessionOutputText,
  writeTerminalInput,
} from "@/app/services/cli/terminalSessions";
import { useTerminalSession } from "@/app/services/cli/useTerminalSession";
import { useThreadDetail } from "@/app/services/cli/useThreadDetail";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import { isTauri } from "@/app/utils/tauri";
import { workspaceNameFromPath } from "@/app/utils/workspace";

import "@xterm/xterm/css/xterm.css";

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
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const writtenEntryIdsRef = useRef<Set<string>>(new Set());
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
  const scopeKey = `${scope.threadId ?? ""}|${scope.workspacePath ?? ""}`;
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
    if (!isOpen || !terminalContainerRef.current || xtermRef.current) {
      return;
    }
    const terminal = new XTerm({
      convertEol: true,
      cursorBlink: true,
      fontFamily:
        '"JetBrains Mono", "Cascadia Mono", "Fira Code", ui-monospace, SFMono-Regular, Consolas, monospace',
      fontSize: 12,
      lineHeight: 1.2,
      theme: {
        background: "#0a0f1f",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalContainerRef.current);
    fitAddon.fit();
    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;
    if (isTauri()) {
      terminal.onData((data) => {
        void writeTerminalInput(scope, data);
      });
    }
    return () => {
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [isOpen, scope]);

  useEffect(() => {
    if (!isOpen || !xtermRef.current) {
      return;
    }
    xtermRef.current.clear();
    writtenEntryIdsRef.current = new Set();
  }, [isOpen, scopeKey]);

  useEffect(() => {
    if (!isOpen || !xtermRef.current) {
      return;
    }
    session.entries.forEach((entry) => {
      if (writtenEntryIdsRef.current.has(entry.id)) {
        return;
      }
      writtenEntryIdsRef.current.add(entry.id);
      xtermRef.current?.writeln(entry.text);
    });
  }, [isOpen, session.entries]);

  useEffect(() => {
    if (!isOpen || !terminalContainerRef.current || !fitAddonRef.current) {
      return;
    }
    const fit = () => {
      const fitAddon = fitAddonRef.current;
      const terminal = xtermRef.current;
      if (!fitAddon || !terminal) {
        return;
      }
      fitAddon.fit();
      if (fitAddon.proposeDimensions()) {
        void resizeTerminalViewport(
          scope,
          Math.max(terminal.cols, 1),
          Math.max(terminal.rows, 1),
        );
      }
    };
    fit();
    const observer = new ResizeObserver(() => {
      fit();
    });
    observer.observe(terminalContainerRef.current);
    return () => observer.disconnect();
  }, [isOpen, scope]);

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
    xtermRef.current?.clear();
    writtenEntryIdsRef.current = new Set();
    setCommandError(null);
  };

  const handleCopy = async () => {
    const xtermSelection = xtermRef.current?.getSelection().trim() ?? "";
    const selectedText = window.getSelection()?.toString().trim() ?? "";
    const text =
      xtermSelection.length > 0
        ? xtermSelection
        : selectedText.length > 0
          ? selectedText
          : sessionOutputText(scope).trim();
    if (!text.length) {
      setCopyMessage("Nothing to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("Copied.");
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
              {copyMessage ?? "Copy"}
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
        <div className="h-52 px-2 py-2">
          <div
            ref={terminalContainerRef}
            className="h-full w-full overflow-hidden"
          />
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
