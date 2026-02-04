import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { RunEvent } from "@/app/types";
import { isTauri } from "@/app/utils/tauri";
import { mapNotificationToRunEvent } from "@/app/services/cli/eventMapper";

const MAX_EVENTS = 200;

export function useAppServerEvents(threadId?: string) {
  const [events, setEvents] = useState<RunEvent[]>([]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;

    listen("app-server-notification", (event) => {
      const payload = event.payload as any;
      if (threadId && payload?.params?.threadId && payload.params.threadId !== threadId) {
        return;
      }
      const mapped = mapNotificationToRunEvent(payload);
      if (!mapped) return;
      setEvents((prev) => [...prev, mapped].slice(-MAX_EVENTS));
    }).then((stop) => {
      unlisten = stop;
    });

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  return events;
}
