import { useParams } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { useAppServerEvents } from "@/app/services/cli/useAppServerEvents";
import { useThreadDetail } from "@/app/services/cli/useThreadDetail";
import { mockThreadDetail } from "@/app/state/mockData";

function highlightDiffTokens(text: string) {
  return text.split(" ").map((token, index) => {
    const key = `${token}-${index}`;
    if (token.startsWith("+")) {
      return (
        <span key={key} className="text-emerald-300">
          {token}
        </span>
      );
    }
    if (token.startsWith("-")) {
      return (
        <span key={key} className="text-rose-300">
          {token}
        </span>
      );
    }
    if (token.includes(".") && token.includes("/")) {
      return (
        <span key={key} className="text-sky-300 underline">
          {token}
        </span>
      );
    }
    return <span key={key}>{token}</span>;
  });
}

export function RunTimeline() {
  const { threadId } = useParams({ from: "/threads/$threadId" });
  const liveEvents = useAppServerEvents(threadId);
  const { thread } = useThreadDetail(threadId);
  const storedEvents = thread?.events ?? mockThreadDetail.events;
  const events = useMemo(() => {
    if (!liveEvents.length) return storedEvents;
    const seen = new Set(storedEvents.map((event) => event.id));
    const merged = [...storedEvents];
    liveEvents.forEach((event) => {
      if (!seen.has(event.id)) {
        merged.push(event);
      }
    });
    return merged;
  }, [liveEvents, storedEvents]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const isExpanded = expandedIds.has(event.id);
        return (
          <div
            key={event.id}
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
          >
            <button
              className="flex w-full items-center justify-between text-left"
              onClick={() => toggleExpanded(event.id)}
            >
              <div>
                <p className="text-sm text-ink-100">{event.label}</p>
                <p className="mt-1 text-xs text-ink-400">{event.timestamp}</p>
              </div>
              <ChevronRight
                className={`h-4 w-4 text-ink-400 transition ${
                  isExpanded ? "rotate-90" : "rotate-0"
                }`}
              />
            </button>
            {isExpanded ? (
              <div className="mt-3 space-y-2 text-xs text-ink-300">
                {event.detail ? (
                  <p className="flex flex-wrap gap-1">
                    {highlightDiffTokens(event.detail)}
                  </p>
                ) : (
                  <p className="text-ink-500">Details hidden.</p>
                )}
                <div className="flex items-center gap-2 text-[0.65rem] text-ink-400">
                  <span className="rounded-full border border-white/10 px-2 py-0.5">
                    {event.status}
                  </span>
                  <span>Awaiting next event stream</span>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
