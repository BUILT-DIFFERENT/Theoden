export type MenuTopLevelId = "file" | "edit" | "view" | "window" | "help";

export type MenuCommandId =
  | "new-thread"
  | "open-automations"
  | "open-skills"
  | "open-settings"
  | "reload-ui"
  | "toggle-terminal"
  | "toggle-review-panel"
  | "open-docs"
  | "file-close-window"
  | "file-quit"
  | "edit-undo"
  | "edit-redo"
  | "edit-cut"
  | "edit-copy"
  | "edit-paste"
  | "edit-select-all"
  | "window-minimize"
  | "window-toggle-maximize"
  | "window-close"
  | "about";

interface MenuSeparator {
  kind: "separator";
}

interface MenuAction {
  kind: "action";
  id: MenuCommandId;
  label: string;
  accelerator?: string;
}

export type MenuEntry = MenuSeparator | MenuAction;

export interface MenuGroup {
  id: MenuTopLevelId;
  label: string;
  entries: MenuEntry[];
}

export interface MenuCommandDependencies {
  navigateHome: () => void;
  navigateAutomations: () => void;
  navigateSkills: () => void;
  navigateSettings: () => void;
  reloadUi: () => void;
  toggleTerminal: () => void;
  toggleReviewPanel: () => void;
  openDocs: () => void;
  closeWindow: () => Promise<void>;
  quitApp: () => Promise<void>;
  minimizeWindow: () => Promise<void>;
  toggleMaximizeWindow: () => Promise<void>;
  performEditAction: (action: EditAction) => void;
  showAbout: () => void;
}

type EditAction = "undo" | "redo" | "cut" | "copy" | "paste" | "selectAll";

export const APP_MENU_GROUPS: MenuGroup[] = [
  {
    id: "file",
    label: "File",
    entries: [
      {
        kind: "action",
        id: "new-thread",
        label: "New Thread",
        accelerator: "Ctrl+N",
      },
      {
        kind: "action",
        id: "open-automations",
        label: "Automations",
        accelerator: "Ctrl+Shift+A",
      },
      {
        kind: "action",
        id: "open-skills",
        label: "Skills",
        accelerator: "Ctrl+Shift+S",
      },
      { kind: "separator" },
      {
        kind: "action",
        id: "open-settings",
        label: "Settings",
        accelerator: "Ctrl+,",
      },
      { kind: "separator" },
      { kind: "action", id: "file-close-window", label: "Close Window" },
      { kind: "action", id: "file-quit", label: "Quit" },
    ],
  },
  {
    id: "edit",
    label: "Edit",
    entries: [
      { kind: "action", id: "edit-undo", label: "Undo" },
      { kind: "action", id: "edit-redo", label: "Redo" },
      { kind: "separator" },
      { kind: "action", id: "edit-cut", label: "Cut" },
      { kind: "action", id: "edit-copy", label: "Copy" },
      { kind: "action", id: "edit-paste", label: "Paste" },
      { kind: "action", id: "edit-select-all", label: "Select All" },
    ],
  },
  {
    id: "view",
    label: "View",
    entries: [
      {
        kind: "action",
        id: "reload-ui",
        label: "Reload UI",
        accelerator: "Ctrl+R",
      },
      {
        kind: "action",
        id: "toggle-terminal",
        label: "Toggle Terminal",
        accelerator: "Ctrl+J",
      },
      {
        kind: "action",
        id: "toggle-review-panel",
        label: "Toggle Review Panel",
        accelerator: "Ctrl+Shift+R",
      },
    ],
  },
  {
    id: "window",
    label: "Window",
    entries: [
      { kind: "action", id: "window-minimize", label: "Minimize" },
      {
        kind: "action",
        id: "window-toggle-maximize",
        label: "Maximize / Restore",
      },
      { kind: "separator" },
      { kind: "action", id: "window-close", label: "Close Window" },
    ],
  },
  {
    id: "help",
    label: "Help",
    entries: [
      {
        kind: "action",
        id: "open-docs",
        label: "Codex Docs",
        accelerator: "F1",
      },
      { kind: "separator" },
      { kind: "action", id: "about", label: "About Codex" },
    ],
  },
];

export async function executeMenuCommand(
  command: MenuCommandId,
  dependencies: MenuCommandDependencies,
) {
  switch (command) {
    case "new-thread":
      dependencies.navigateHome();
      return;
    case "open-automations":
      dependencies.navigateAutomations();
      return;
    case "open-skills":
      dependencies.navigateSkills();
      return;
    case "open-settings":
      dependencies.navigateSettings();
      return;
    case "reload-ui":
      dependencies.reloadUi();
      return;
    case "toggle-terminal":
      dependencies.toggleTerminal();
      return;
    case "toggle-review-panel":
      dependencies.toggleReviewPanel();
      return;
    case "open-docs":
      dependencies.openDocs();
      return;
    case "file-close-window":
    case "window-close":
      await dependencies.closeWindow();
      return;
    case "file-quit":
      await dependencies.quitApp();
      return;
    case "window-minimize":
      await dependencies.minimizeWindow();
      return;
    case "window-toggle-maximize":
      await dependencies.toggleMaximizeWindow();
      return;
    case "edit-undo":
      dependencies.performEditAction("undo");
      return;
    case "edit-redo":
      dependencies.performEditAction("redo");
      return;
    case "edit-cut":
      dependencies.performEditAction("cut");
      return;
    case "edit-copy":
      dependencies.performEditAction("copy");
      return;
    case "edit-paste":
      dependencies.performEditAction("paste");
      return;
    case "edit-select-all":
      dependencies.performEditAction("selectAll");
      return;
    case "about":
      dependencies.showAbout();
      return;
    default:
      return;
  }
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tagName = target.tagName.toLowerCase();
  if (tagName === "textarea") {
    return true;
  }
  if (tagName !== "input") {
    return false;
  }
  const input = target as HTMLInputElement;
  const type = (input.type || "text").toLowerCase();
  return !["button", "checkbox", "radio", "submit"].includes(type);
}

export function resolveMenuShortcut(
  event: KeyboardEvent,
): MenuCommandId | null {
  const key = event.key.toLowerCase();
  const hasShortcutModifier = event.metaKey || event.ctrlKey;

  if (key === "f1") {
    return "open-docs";
  }

  if (hasShortcutModifier) {
    if (!event.altKey && !event.shiftKey && key === "n") {
      return "new-thread";
    }
    if (!event.altKey && event.shiftKey && key === "a") {
      return "open-automations";
    }
    if (!event.altKey && event.shiftKey && key === "s") {
      return "open-skills";
    }
    if (!event.altKey && !event.shiftKey && key === ",") {
      return "open-settings";
    }
    if (!event.altKey && !event.shiftKey && key === "r") {
      return "reload-ui";
    }
    if (!event.altKey && !event.shiftKey && key === "j") {
      return "toggle-terminal";
    }
    if (!event.altKey && event.shiftKey && key === "r") {
      return "toggle-review-panel";
    }
    return null;
  }

  if (
    event.altKey ||
    event.shiftKey ||
    event.repeat ||
    isTypingTarget(event.target)
  ) {
    return null;
  }

  if (key === "n") {
    return "new-thread";
  }
  if (key === "a") {
    return "open-automations";
  }
  if (key === "s") {
    return "open-skills";
  }
  return null;
}
