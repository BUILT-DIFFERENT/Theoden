import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { isTauri } from "@/app/utils/tauri";

export interface HostDeeplinkPayload {
  route: string;
  section: string | null;
  threadId: string | null;
  taskId: string | null;
  pendingId: string | null;
}

export interface HostUpdateState {
  status: "idle" | "checking" | "available" | "up_to_date" | "error";
  detail: string | null;
  checkedAt: number | null;
}

export interface HostBuildFlavor {
  flavor: string;
  platform: string;
  channel: string;
}

function canUseRuntimeBridge() {
  if (!isTauri()) {
    return false;
  }
  if (typeof window === "undefined") {
    return false;
  }
  return Boolean(
    (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__,
  );
}

export async function dispatchHostDeeplink(url: string) {
  if (!canUseRuntimeBridge()) {
    throw new Error("Deeplink dispatch is available only in desktop runtime.");
  }
  return invoke<HostDeeplinkPayload>("host_dispatch_deeplink", { url });
}

export async function getHostUpdateState() {
  if (!canUseRuntimeBridge()) {
    return {
      status: "idle",
      detail: "Desktop runtime unavailable",
      checkedAt: null,
    } satisfies HostUpdateState;
  }
  return invoke<HostUpdateState>("host_get_update_state");
}

export async function checkForHostUpdates() {
  if (!canUseRuntimeBridge()) {
    return {
      status: "idle",
      detail: "Desktop runtime unavailable",
      checkedAt: null,
    } satisfies HostUpdateState;
  }
  return invoke<HostUpdateState>("host_check_updates");
}

export async function subscribeHostDeeplinks(
  listener: (payload: HostDeeplinkPayload) => void,
) {
  if (!canUseRuntimeBridge()) {
    return () => {};
  }
  let unlisten: (() => void) | null = null;
  try {
    unlisten = await listen<HostDeeplinkPayload>("host-deeplink", (event) =>
      listener(event.payload),
    );
  } catch (error) {
    console.warn("Failed to subscribe to host deeplink events", error);
  }
  return () => {
    unlisten?.();
  };
}

export async function subscribeHostUpdateState(
  listener: (payload: HostUpdateState) => void,
) {
  if (!canUseRuntimeBridge()) {
    return () => {};
  }
  let unlisten: (() => void) | null = null;
  try {
    unlisten = await listen<HostUpdateState>("host-update-state", (event) =>
      listener(event.payload),
    );
  } catch (error) {
    console.warn("Failed to subscribe to host update state events", error);
  }
  return () => {
    unlisten?.();
  };
}

export async function getBridgeBuildFlavor() {
  if (!canUseRuntimeBridge()) {
    return {
      flavor: "web",
      platform: "browser",
      channel: "dev",
    } satisfies HostBuildFlavor;
  }
  return invoke<HostBuildFlavor>("bridge_get_build_flavor");
}
