import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

import {
  getString,
  parseAppServerNotification,
} from "@/app/services/cli/appServerPayload";
import { mapNotificationToRunEvent } from "@/app/services/cli/eventMapper";
import type { RunEvent } from "@/app/types";
import { isTauri } from "@/app/utils/tauri";

const MAX_EVENTS = 200;

export function useAppServerEvents(threadId?: string) {
  const [events, setEvents] = useState<RunEvent[]>([]);

  useEffect(() => {
    setEvents([]);
  }, [threadId]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    let active = true;

    const listenPromise = listen("app-server-notification", (event) => {
      const notification = parseAppServerNotification(event.payload);
      if (!notification) return;
      if (threadId) {
        const payloadThreadId = notification.params
          ? getString(notification.params, "threadId")
          : undefined;
        if (payloadThreadId && payloadThreadId !== threadId) return;
      }
      const mapped = mapNotificationToRunEvent(notification);
      if (!mapped) return;
      setEvents((prev) => [...prev, mapped].slice(-MAX_EVENTS));
    })
      .then((stop) => {
        if (active) {
          unlisten = stop;
          return;
        }
        stop();
      })
      .catch((error) => {
        console.warn("Failed to subscribe to app-server-notification", error);
      });
    void listenPromise;

    return () => {
      active = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, [
    getString,
    isTauri,
    listen,
    mapNotificationToRunEvent,
    parseAppServerNotification,
    threadId,
  ]);

  return events;
}
