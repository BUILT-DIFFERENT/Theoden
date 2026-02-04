import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { RunEvent } from "@/app/types";
import { isTauri } from "@/app/utils/tauri";
import { mapNotificationToRunEvent } from "@/app/services/cli/eventMapper";

const MAX_EVENTS = 200;

export function useAppServerEvents() {
  const [events, setEvents] = useState<RunEvent[]>([]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;

    listen("app-server-notification", (event) => {
      const mapped = mapNotificationToRunEvent(event.payload as any);
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
