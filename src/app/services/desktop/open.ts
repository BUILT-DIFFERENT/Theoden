import {
  execCommand,
  type CommandExecResult,
} from "@/app/services/cli/commands";

type DesktopPlatform = "windows" | "macos" | "linux";

function detectDesktopPlatform(): DesktopPlatform {
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
