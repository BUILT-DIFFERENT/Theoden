import { listen } from "@tauri-apps/api/event";

import {
  parseAppServerNotification,
  parseAppServerRequest,
  type AppServerNotification,
  type AppServerRequest,
} from "@/app/services/cli/appServerPayload";
import { isTauri } from "@/app/utils/tauri";

type NotificationListener = (notification: AppServerNotification) => void;
type RequestListener = (request: AppServerRequest) => void;

const notificationListeners = new Set<NotificationListener>();
const requestListeners = new Set<RequestListener>();

let unlistenNotification: (() => void) | null = null;
let unlistenRequest: (() => void) | null = null;
let setupPromise: Promise<void> | null = null;

async function ensureSubscribed() {
  if (!isTauri()) {
    return;
  }
  if (unlistenNotification && unlistenRequest) {
    return;
  }
  if (setupPromise) {
    await setupPromise;
    return;
  }
  setupPromise = (async () => {
    if (!unlistenNotification) {
      unlistenNotification = await listen(
        "app-server-notification",
        (event) => {
          const notification = parseAppServerNotification(event.payload);
          if (!notification) {
            return;
          }
          notificationListeners.forEach((listener) => listener(notification));
        },
      );
    }

    if (!unlistenRequest) {
      unlistenRequest = await listen("app-server-request", (event) => {
        const request = parseAppServerRequest(event.payload);
        if (!request) {
          return;
        }
        requestListeners.forEach((listener) => listener(request));
      });
    }
  })()
    .catch((error) => {
      console.warn("Failed to subscribe to app-server events", error);
      unlistenNotification?.();
      unlistenRequest?.();
      unlistenNotification = null;
      unlistenRequest = null;
    })
    .finally(() => {
      setupPromise = null;
    });
  await setupPromise;
}

function maybeDisposeSubscriptions() {
  if (!isTauri()) {
    return;
  }
  if (notificationListeners.size || requestListeners.size) {
    return;
  }
  unlistenNotification?.();
  unlistenRequest?.();
  unlistenNotification = null;
  unlistenRequest = null;
}

export function subscribeAppServerNotifications(
  listener: NotificationListener,
) {
  notificationListeners.add(listener);
  void ensureSubscribed();
  return () => {
    notificationListeners.delete(listener);
    maybeDisposeSubscriptions();
  };
}

export function subscribeAppServerRequests(listener: RequestListener) {
  requestListeners.add(listener);
  void ensureSubscribed();
  return () => {
    requestListeners.delete(listener);
    maybeDisposeSubscriptions();
  };
}
