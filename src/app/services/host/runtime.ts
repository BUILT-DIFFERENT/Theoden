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

export type HostRendererMode = "compat" | "rewrite";

export interface HostRendererModePayload {
  mode: HostRendererMode;
}

export interface HostBridgeMessage {
  channel: string;
  payload: unknown;
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

export async function sendBridgeMessageFromView(params: HostBridgeMessage) {
  if (!canUseRuntimeBridge()) {
    return;
  }
  await invoke("bridge_message_from_view", { params });
}

export async function showBridgeContextMenu(payload?: unknown) {
  if (!canUseRuntimeBridge()) {
    return true;
  }
  return invoke<boolean>("bridge_show_context_menu", {
    payload: payload ?? null,
  });
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

function parseRendererMode(raw: string | undefined): HostRendererMode {
  return raw === "compat" ? "compat" : "rewrite";
}

function readRendererModeFromEnv() {
  const env = import.meta.env as Record<string, unknown>;
  const value = env["VITE_DESKTOP_RENDERER_MODE"];
  return typeof value === "string" ? value : undefined;
}

export async function getHostRendererMode() {
  const fallback = {
    mode: parseRendererMode(readRendererModeFromEnv()),
  } satisfies HostRendererModePayload;
  if (!canUseRuntimeBridge()) {
    return fallback;
  }
  try {
    return invoke<HostRendererModePayload>("host_get_renderer_mode");
  } catch (error) {
    console.warn("Failed to load host renderer mode", error);
    return fallback;
  }
}

export async function subscribeBridgeMessageForView(
  listener: (payload: HostBridgeMessage) => void,
) {
  if (!canUseRuntimeBridge()) {
    return () => {};
  }
  let unlisten: (() => void) | null = null;
  try {
    unlisten = await listen<HostBridgeMessage>(
      "codex-desktop-message-for-view",
      (event) => listener(event.payload),
    );
  } catch (error) {
    console.warn("Failed to subscribe to bridge view messages", error);
  }
  return () => {
    unlisten?.();
  };
}
