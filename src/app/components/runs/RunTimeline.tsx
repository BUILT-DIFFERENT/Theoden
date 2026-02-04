import { mockThreadDetail } from "@/app/state/mockData";
import { useAppServerEvents } from "@/app/services/cli/useAppServerEvents";
import { useParams } from "@tanstack/react-router";

export function RunTimeline() {
  const { threadId } = useParams({ from: "/threads/$threadId" });
  const liveEvents = useAppServerEvents(threadId);
  const events = liveEvents.length ? liveEvents : mockThreadDetail.events;
  return (
    <div className="space-y-4">
      {events.map((event) => (
        <div key={event.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-100">{event.label}</p>
            <span className="text-xs text-ink-400">{event.timestamp}</span>
          </div>
          <p className="mt-2 text-xs text-ink-300">{event.detail}</p>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-ink-300">
              {event.status}
            </span>
            <span className="text-ink-400">Awaiting next event stream</span>
          </div>
        </div>
      ))}
    </div>
  );
}
