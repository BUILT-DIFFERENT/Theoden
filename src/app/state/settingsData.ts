import type { EditorOption, ProviderStatus } from "@/app/types";

export const mockEditors: EditorOption[] = [
  { id: "vscode", name: "Visual Studio Code", detected: true, command: "code" },
  { id: "intellij", name: "IntelliJ IDEA", detected: false, command: "idea" },
  { id: "webstorm", name: "WebStorm", detected: false, command: "webstorm" },
];

export const mockProviders: ProviderStatus[] = [
  { id: "local", status: "ready", detail: "codex app-server connected" },
  {
    id: "worktree",
    status: "ready",
    detail: "Workspace clone strategy enabled",
  },
  { id: "cloud", status: "stub", detail: "codex cloud exec not wired yet" },
];
