import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { isTauri } from "@/app/utils/tauri";

export interface HostTerminalSession {
  sessionId: string;
  threadId: string | null;
  workspacePath: string | null;
  cwd: string | null;
  isRunning: boolean;
  interactive: boolean;
  supportsResize: boolean;
  mode: "pty" | "stateless";
  updatedAt: number;
}

export interface HostTerminalDataEvent {
  sessionId: string;
  stream: "stdin" | "stdout" | "stderr";
  data: string;
}

export interface HostTerminalExitEvent {
  sessionId: string;
  code: number;
}

export interface HostTerminalErrorEvent {
  sessionId: string;
  error: string;
}

export async function listTerminalSessions() {
  if (!isTauri()) {
    return [] as HostTerminalSession[];
  }
  return invoke<HostTerminalSession[]>("terminal_list");
}

export async function createTerminalSession(params: {
  threadId?: string;
  workspacePath?: string | null;
  cwd?: string | null;
}) {
  return invoke<HostTerminalSession>("terminal_create", {
    params: {
      threadId: params.threadId ?? null,
      workspacePath: params.workspacePath ?? null,
      cwd: params.cwd ?? null,
    },
  });
}

export async function attachTerminalSession(sessionId: string) {
  return invoke<HostTerminalSession>("terminal_attach", {
    params: {
      sessionId,
    },
  });
}

export async function writeTerminalSession(
  sessionId: string,
  input: string,
  raw = false,
) {
  await invoke("terminal_write", {
    params: {
      sessionId,
      input,
      raw,
    },
  });
}

export async function resizeTerminalSession(
  sessionId: string,
  cols: number,
  rows: number,
) {
  await invoke("terminal_resize", {
    params: {
      sessionId,
      cols,
      rows,
    },
  });
}

export async function closeTerminalSession(sessionId: string) {
  await invoke("terminal_close", {
    params: {
      sessionId,
    },
  });
}

export async function subscribeTerminalEvents(handlers: {
  onAttached?: (payload: HostTerminalSession) => void;
  onData?: (payload: HostTerminalDataEvent) => void;
  onExit?: (payload: HostTerminalExitEvent) => void;
  onError?: (payload: HostTerminalErrorEvent) => void;
}) {
  if (!isTauri()) {
    return () => {};
  }
  const unlistenAttached = await listen<HostTerminalSession>(
    "terminal-attached",
    (event) => handlers.onAttached?.(event.payload),
  );
  const unlistenData = await listen<HostTerminalDataEvent>(
    "terminal-data",
    (event) => handlers.onData?.(event.payload),
  );
  const unlistenExit = await listen<HostTerminalExitEvent>(
    "terminal-exit",
    (event) => handlers.onExit?.(event.payload),
  );
  const unlistenError = await listen<HostTerminalErrorEvent>(
    "terminal-error",
    (event) => handlers.onError?.(event.payload),
  );
  return () => {
    unlistenAttached();
    unlistenData();
    unlistenExit();
    unlistenError();
  };
}
