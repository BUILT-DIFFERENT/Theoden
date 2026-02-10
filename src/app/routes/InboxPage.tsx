import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import {
  listInboxItems,
  markInboxRead,
  subscribeAutomationStoreUpdates,
} from "@/app/services/host/automations";
import { isTauri } from "@/app/utils/tauri";

export function InboxPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const desktop = isTauri();
  const inboxQuery = useQuery({
    queryKey: ["host", "inbox-items"],
    queryFn: listInboxItems,
    enabled: desktop,
    refetchOnWindowFocus: desktop,
  });

  useEffect(() => {
    if (!desktop) {
      return;
    }
    let unlisten: (() => void) | null = null;
    void subscribeAutomationStoreUpdates(() => {
      void queryClient.invalidateQueries({ queryKey: ["host", "inbox-items"] });
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => {
      unlisten?.();
    };
  }, [desktop, queryClient]);

  const items = useMemo(
    () =>
      [...(inboxQuery.data ?? [])].sort(
        (left, right) => right.createdAt - left.createdAt,
      ),
    [inboxQuery.data],
  );
  const unreadCount = items.filter((item) => item.readAt === null).length;

  const openThread = async (item: (typeof items)[number]) => {
    setActionError(null);
    try {
      if (item.readAt === null) {
        await markInboxRead(item.id);
      }
      await queryClient.invalidateQueries({
        queryKey: ["host", "inbox-items"],
      });
      await navigate({
        to: "/t/$threadId",
        params: {
          threadId: item.threadId,
        },
      });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to open inbox item.",
      );
    }
  };

  if (!desktop) {
    return (
      <section className="surface-panel p-5">
        <h1 className="font-display text-2xl text-ink-50">Inbox</h1>
        <p className="mt-2 text-sm text-ink-300">
          Inbox is available in the desktop app.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="surface-panel p-5">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">Inbox</p>
        <h1 className="mt-2 font-display text-2xl text-ink-50">
          Automation updates
        </h1>
        <p className="mt-2 text-sm text-ink-300">
          Unread items: <span className="text-ink-100">{unreadCount}</span>
        </p>
        {actionError ? (
          <p className="mt-2 text-xs text-rose-300">{actionError}</p>
        ) : null}
      </div>
      <div className="surface-panel p-4">
        {inboxQuery.isLoading ? (
          <p className="text-sm text-ink-400">Loading inbox…</p>
        ) : items.length ? (
          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                  item.readAt === null
                    ? "border-sky-300/40 bg-sky-400/10 text-ink-50"
                    : "border-white/10 bg-black/20 text-ink-300 hover:border-flare-300"
                }`}
                onClick={() => {
                  void openThread(item);
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm">{item.title}</p>
                  <span className="text-[0.65rem] text-ink-500">
                    {new Date(item.createdAt * 1000).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-400">{item.description}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2 text-sm text-ink-400">
            <p>No inbox items yet.</p>
            <p>
              Start from <Link to="/automations">Automations</Link> to schedule
              runs.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
