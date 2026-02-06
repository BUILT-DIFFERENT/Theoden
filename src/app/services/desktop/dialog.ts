import { open } from "@tauri-apps/plugin-dialog";

import { isTauri } from "@/app/utils/tauri";

export async function pickWorkspaceDirectory(): Promise<string | null> {
  if (!isTauri()) {
    return null;
  }

  const selection = await open({
    directory: true,
    multiple: false,
    title: "Select workspace folder",
  });

  if (typeof selection === "string") {
    return selection;
  }

  if (Array.isArray(selection)) {
    return selection[0] ?? null;
  }

  return null;
}
