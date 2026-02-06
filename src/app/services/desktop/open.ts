import {
  execCommand,
  type CommandExecResult,
} from "@/app/services/cli/commands";

export type DesktopPlatform = "windows" | "macos" | "linux";

export interface OpenTargetOption {
  id:
    | "editor"
    | "terminal"
    | "explorer"
    | "windows-terminal"
    | "command-prompt";
  label: string;
  detail: string;
}

export function detectDesktopPlatform(): DesktopPlatform {
  if (typeof navigator === "undefined") {
    return "linux";
  }
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("windows")) {
    return "windows";
  }
  if (
    userAgent.includes("macintosh") ||
    userAgent.includes("mac os x") ||
    userAgent.includes("darwin")
  ) {
    return "macos";
  }
  return "linux";
}

function ensureSuccess(result: CommandExecResult, action: string) {
  if (result.exitCode === 0) {
    return;
  }
  const message = result.stderr.trim() || result.stdout.trim();
  throw new Error(`${action} failed${message ? `: ${message}` : ""}`);
}

async function runCommand(command: string[], action: string) {
  const result = await execCommand({ command });
  ensureSuccess(result, action);
}

export function openTargetOptions(editorName: string): OpenTargetOption[] {
  const platform = detectDesktopPlatform();
  const targets: OpenTargetOption[] = [
    {
      id: "editor",
      label: `Open in ${editorName}`,
      detail: "Use configured editor command",
    },
    {
      id: "terminal",
      label:
        platform === "windows"
          ? "Open in terminal"
          : platform === "macos"
            ? "Open in Terminal"
            : "Open in terminal",
      detail:
        platform === "windows"
          ? "Default shell launcher"
          : platform === "macos"
            ? "Apple Terminal"
            : "Detected terminal app",
    },
    {
      id: "explorer",
      label:
        platform === "windows"
          ? "Open in File Explorer"
          : platform === "macos"
            ? "Open in Finder"
            : "Open in file manager",
      detail:
        platform === "windows"
          ? "Reveal folder in Explorer"
          : platform === "macos"
            ? "Reveal folder in Finder"
            : "Reveal folder in file manager",
    },
  ];

  if (platform === "windows") {
    targets.splice(1, 0, {
      id: "windows-terminal",
      label: "Open in Windows Terminal",
      detail: "Launch wt with workspace cwd",
    });
    targets.splice(2, 0, {
      id: "command-prompt",
      label: "Open in Command Prompt",
      detail: "Launch cmd.exe in workspace",
    });
  }

  return targets;
}

export async function openPathInExplorer(path: string) {
  const platform = detectDesktopPlatform();
  if (platform === "windows") {
    await runCommand(["explorer", path], "Open in file explorer");
    return;
  }
  if (platform === "macos") {
    await runCommand(["open", path], "Open in finder");
    return;
  }
  await runCommand(["xdg-open", path], "Open in file explorer");
}

export async function openInEditor(path: string, editorCommand: string) {
  const command = editorCommand.trim();
  if (!command) {
    throw new Error("No editor command is configured.");
  }
  await runCommand([command, path], "Open in editor");
}

export async function openPathInTerminal(path: string) {
  const platform = detectDesktopPlatform();
  if (platform === "windows") {
    await runCommand(
      ["cmd", "/c", "start", "cmd", "/K", `cd /d "${path}"`],
      "Open in terminal",
    );
    return;
  }
  if (platform === "macos") {
    await runCommand(["open", "-a", "Terminal", path], "Open in terminal");
    return;
  }

  let lastError: Error | null = null;
  for (const command of [
    ["x-terminal-emulator", "--working-directory", path],
    ["gnome-terminal", "--working-directory", path],
    ["konsole", "--workdir", path],
    ["alacritty", "--working-directory", path],
  ]) {
    try {
      await runCommand(command, "Open in terminal");
      return;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Open in terminal failed.");
    }
  }

  throw lastError ?? new Error("No terminal launcher was found.");
}

export async function openPathInWindowsTerminal(path: string) {
  const platform = detectDesktopPlatform();
  if (platform !== "windows") {
    throw new Error("Windows Terminal is only available on Windows.");
  }
  const fallback = ["cmd", "/c", "start", "cmd", "/K", `cd /d "${path}"`];
  try {
    await runCommand(["wt", "-d", path], "Open in Windows Terminal");
  } catch (error) {
    console.warn(
      "Failed to launch Windows Terminal, falling back to cmd",
      error,
    );
    await runCommand(fallback, "Open in Command Prompt");
  }
}

export async function openPathInCommandPrompt(path: string) {
  const platform = detectDesktopPlatform();
  if (platform !== "windows") {
    throw new Error("Command Prompt is only available on Windows.");
  }
  await runCommand(
    ["cmd", "/c", "start", "cmd", "/K", `cd /d "${path}"`],
    "Open in Command Prompt",
  );
}
