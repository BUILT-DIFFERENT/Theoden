import { hostAdapter } from "@/app/services/host/adapter";
import { type HostBridgeMessage } from "@/app/services/host/runtime";
import { isTauri } from "@/app/utils/tauri";

type BridgeListener = (payload: unknown) => void;

interface ElectronBridgeCompat {
  send: (channel: string, payload?: unknown) => void;
  invoke: (channel: string, payload?: unknown) => Promise<unknown>;
  on: (channel: string, listener: BridgeListener) => () => void;
  off: (channel: string, listener: BridgeListener) => void;
}

const CHANNEL_MESSAGE_FROM_VIEW = "codex_desktop:message-from-view";
const CHANNEL_MESSAGE_FOR_VIEW = "codex_desktop:message-for-view";
const CHANNEL_SHOW_CONTEXT_MENU = "codex_desktop:show-context-menu";
const CHANNEL_GET_BUILD_FLAVOR = "codex_desktop:get-build-flavor";

const listenerMap = new Map<string, Set<BridgeListener>>();
let initialized = false;

function notify(channel: string, payload: unknown) {
  const listeners = listenerMap.get(channel);
  if (!listeners || !listeners.size) {
    return;
  }
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      console.warn(`electronBridge listener failed for "${channel}"`, error);
    }
  });
}

function subscribe(channel: string, listener: BridgeListener) {
  const listeners = listenerMap.get(channel) ?? new Set<BridgeListener>();
  listeners.add(listener);
  listenerMap.set(channel, listeners);
  return () => {
    const current = listenerMap.get(channel);
    if (!current) return;
    current.delete(listener);
    if (!current.size) {
      listenerMap.delete(channel);
    }
  };
}

function unsubscribe(channel: string, listener: BridgeListener) {
  const listeners = listenerMap.get(channel);
  if (!listeners) return;
  listeners.delete(listener);
  if (!listeners.size) {
    listenerMap.delete(channel);
  }
}

const bridge: ElectronBridgeCompat = {
  send(channel, payload) {
    if (channel === CHANNEL_SHOW_CONTEXT_MENU) {
      void hostAdapter.runtime.showBridgeContextMenu(payload);
      return;
    }
    if (
      channel === CHANNEL_MESSAGE_FROM_VIEW ||
      channel === CHANNEL_MESSAGE_FOR_VIEW
    ) {
      void hostAdapter.runtime.sendBridgeMessageFromView({ channel, payload });
      return;
    }
    void hostAdapter.runtime.sendBridgeMessageFromView({ channel, payload });
  },
  async invoke(channel, payload) {
    if (channel === CHANNEL_GET_BUILD_FLAVOR) {
      return hostAdapter.runtime.getBridgeBuildFlavor();
    }
    if (channel === CHANNEL_SHOW_CONTEXT_MENU) {
      return hostAdapter.runtime.showBridgeContextMenu(payload);
    }
    await hostAdapter.runtime.sendBridgeMessageFromView({ channel, payload });
    return null;
  },
  on(channel, listener) {
    return subscribe(channel, listener);
  },
  off(channel, listener) {
    unsubscribe(channel, listener);
  },
};

function forwardHostMessage(payload: HostBridgeMessage) {
  notify(payload.channel, payload.payload);
  if (payload.channel !== CHANNEL_MESSAGE_FOR_VIEW) {
    notify(CHANNEL_MESSAGE_FOR_VIEW, payload.payload);
  }
}

export function initializeElectronCompatBridge() {
  if (initialized || typeof window === "undefined") {
    return;
  }
  initialized = true;
  window.electronBridge = bridge;
  window.codexWindowType = "main";

  if (!isTauri()) {
    return;
  }

  void hostAdapter.runtime.subscribeBridgeMessageForView((payload) => {
    forwardHostMessage(payload);
  });
}

declare global {
  interface Window {
    electronBridge?: ElectronBridgeCompat;
    codexWindowType?: string;
  }
}
