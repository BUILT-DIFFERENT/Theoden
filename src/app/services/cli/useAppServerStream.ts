import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

import { registerActiveRunNotification } from "@/app/services/cli/activeRuns";
import {
  registerApprovalItem,
  registerApprovalRequest,
} from "@/app/services/cli/approvals";
import {
  parseAppServerNotification,
  parseAppServerRequest,
} from "@/app/services/cli/appServerPayload";
import { registerDiffNotification } from "@/app/services/cli/diffUpdates";
import { isTauri } from "@/app/utils/tauri";

export function useAppServerStream() {
  useEffect(() => {
    if (!isTauri()) return;
    let unlistenNotification: (() => void) | null = null;
    let unlistenRequest: (() => void) | null = null;
    let active = true;

    const notificationPromise = listen("app-server-notification", (event) => {
      const notification = parseAppServerNotification(event.payload);
      if (notification) {
        registerActiveRunNotification(notification);
        registerApprovalItem(notification);
        registerDiffNotification(notification);
      }
    })
      .then((stop) => {
        if (active) {
          unlistenNotification = stop;
          return;
        }
        stop();
      })
      .catch((error) => {
        console.warn("Failed to subscribe to app-server-notification", error);
      });

    const requestPromise = listen("app-server-request", (event) => {
      const request = parseAppServerRequest(event.payload);
      if (!request) return;
      registerApprovalRequest(request);
    })
      .then((stop) => {
        if (active) {
          unlistenRequest = stop;
          return;
        }
        stop();
      })
      .catch((error) => {
        console.warn("Failed to subscribe to app-server-request", error);
      });
    void notificationPromise;
    void requestPromise;

    return () => {
      active = false;
      if (unlistenNotification) unlistenNotification();
      if (unlistenRequest) unlistenRequest();
    };
  }, [
    isTauri,
    listen,
    parseAppServerNotification,
    parseAppServerRequest,
    registerActiveRunNotification,
    registerApprovalItem,
    registerDiffNotification,
    registerApprovalRequest,
  ]);
}
