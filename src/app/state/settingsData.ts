import type { EditorOption, ProviderStatus } from "@/app/types";

export type SettingsSectionId =
  | "general"
  | "account"
  | "data-controls"
  | "usage-analytics"
  | "configuration"
  | "personalization"
  | "mcp-servers"
  | "skills"
  | "git"
  | "environments"
  | "worktrees"
  | "archived-threads";

export interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  description: string;
}

export const defaultSettingsSection: SettingsSectionId = "general";

export const settingsSections: SettingsSection[] = [
  {
    id: "general",
    label: "General",
    description: "Default editor destination and basic preferences.",
  },
  {
    id: "account",
    label: "Account",
    description: "Authentication status and sign-in controls.",
  },
  {
    id: "data-controls",
    label: "Data controls",
    description: "Storage locations and privacy management links.",
  },
  {
    id: "usage-analytics",
    label: "Usage & analytics",
    description: "Rate-limit visibility and analytics management links.",
  },
  {
    id: "configuration",
    label: "Configuration",
    description: "View and validate merged config.toml values.",
  },
  {
    id: "personalization",
    label: "Personalization",
    description: "Tailor assistant voice and UI behavior.",
  },
  {
    id: "mcp-servers",
    label: "MCP servers",
    description: "Manage connected MCP tools and endpoints.",
  },
  {
    id: "skills",
    label: "Skills",
    description: "Control skill trust and install defaults.",
  },
  {
    id: "git",
    label: "Git",
    description: "Commit identity and default branch behavior.",
  },
  {
    id: "environments",
    label: "Environments",
    description: "Choose local/worktree/cloud execution defaults.",
  },
  {
    id: "worktrees",
    label: "Worktrees",
    description: "Tune worktree creation and cleanup policies.",
  },
  {
    id: "archived-threads",
    label: "Archived threads",
    description: "Restore and retention controls for archived runs.",
  },
];

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
  {
    id: "cloud",
    status: "unavailable",
    detail: "Configure cloud environment to run remote tasks",
  },
];
