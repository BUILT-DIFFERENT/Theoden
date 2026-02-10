import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  forkThread,
  listLoadedThreads,
  rollbackThread,
} from "@/app/services/cli/threads";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { useThreadUi } from "@/app/state/threadUi";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import type { ThreadDetail } from "@/app/types";
import {
  resolveWorkspacePath,
  workspaceNameFromPath,
} from "@/app/utils/workspace";

interface ThreadTopBarProps {
  thread?: ThreadDetail;
  isNewThread?: boolean;
  title?: string;
  variant?: "thread" | "new-thread" | "page";
}

export function ThreadTopBar({
  thread,
  isNewThread,
  title,
  variant,
}: ThreadTopBarProps) {
  const { reviewOpen, setReviewOpen } = useThreadUi();
  const { selectedWorkspace } = useWorkspaceUi();
  const { workspaces } = useWorkspaces();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const matchRoute = useMatchRoute();
  const threadMatch = matchRoute({ to: "/t/$threadId" });
  const threadId = threadMatch ? threadMatch.threadId : undefined;
  const resolvedWorkspacePath = resolveWorkspacePath({
    threadSubtitle: thread?.subtitle,
    selectedWorkspace,
    workspaces,
  });
  const subtitle = resolvedWorkspacePath
    ? workspaceNameFromPath(resolvedWorkspacePath)
    : "Pick a workspace";
  const resolvedVariant = variant
    ? variant
    : isNewThread
      ? "new-thread"
      : threadId
        ? "thread"
        : "page";
  const headerTitle =
    resolvedVariant === "new-thread"
      ? "New thread"
      : resolvedVariant === "thread"
        ? (thread?.title ?? title ?? "Thread")
        : (title ?? "Codex");
  const showThreadHeader = resolvedVariant === "thread";
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [menuActionError, setMenuActionError] = useState<string | null>(null);
  const [menuActionBusy, setMenuActionBusy] = useState<
    "fork" | "rollback" | null
  >(null);
  const headerMenuRef = useRef<HTMLDivElement | null>(null);
  const changeSummary = thread?.diffSummary;
  const hasChanges = Boolean(
    changeSummary &&
      (changeSummary.additions > 0 || changeSummary.deletions > 0),
  );
  const loadedThreadsQuery = useQuery({
    queryKey: ["threads", "loaded", "topbar"],
    queryFn: () => listLoadedThreads({ limit: 200 }),
    refetchOnWindowFocus: true,
  });
  const loadedThreadCount = loadedThreadsQuery.data?.data.length ?? 0;
  const isCurrentThreadLoaded = Boolean(
    threadId &&
      loadedThreadsQuery.data?.data.some(
        (loadedThreadId) => loadedThreadId === threadId,
      ),
  );

  useEffect(() => {
    if (!headerMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (headerMenuRef.current?.contains(event.target as Node)) return;
      setHeaderMenuOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [headerMenuOpen]);

  const handleCopyValue = async (value: string | null | undefined) => {
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.warn("Failed to copy value", error);
    }
  };

  const handleCopyWorkingDirectory = async () => {
    await handleCopyValue(resolvedWorkspacePath);
  };

  const handleCopySessionId = async () => {
    await handleCopyValue(threadId ?? null);
  };

  const handleCopyAppLink = async () => {
    const threadLink = threadId
      ? new URL(`/t/${threadId}`, window.location.origin).toString()
      : new URL("/", window.location.origin).toString();
    await handleCopyValue(threadLink);
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0d111a]/88 px-5 py-3.5">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-lg text-ink-50">{headerTitle}</h1>
        {showThreadHeader ? (
          <span className="text-xs text-ink-400">
            {subtitle}
            {isCurrentThreadLoaded ? " · loaded" : ""}
          </span>
        ) : null}
      </div>
      {showThreadHeader ? (
        <div className="flex items-center gap-2">
          {hasChanges ? (
            <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[0.68rem] text-ink-300">
              +{changeSummary?.additions ?? 0} -{changeSummary?.deletions ?? 0}
            </span>
          ) : null}
          <div className="relative" ref={headerMenuRef}>
            <button
              className="btn-flat px-2 text-ink-400"
              onClick={() => setHeaderMenuOpen((open) => !open)}
              aria-label="Thread options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {headerMenuOpen ? (
              <div className="surface-panel absolute right-0 top-8 z-20 w-52 p-2 text-[0.7rem] text-ink-200">
                <button
                  className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    void handleCopyWorkingDirectory();
                  }}
                >
                  Copy working directory
                </button>
                <button
                  className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    void handleCopySessionId();
                  }}
                >
                  Copy session ID
                </button>
                <button
                  className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    void handleCopyAppLink();
                  }}
                >
                  Copy app link
                </button>
                <button
                  className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    void navigate({
                      to: "/settings/$section",
                      params: { section: "general" },
                    });
                  }}
                >
                  Open settings
                </button>
                <button
                  className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    setReviewOpen(!reviewOpen);
                  }}
                >
                  {reviewOpen ? "Hide review panel" : "Show review panel"}
                </button>
                <button
                  className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5 disabled:opacity-60"
                  disabled={menuActionBusy !== null}
                  onClick={() => {
                    if (!threadId) {
                      setMenuActionError("No active thread to fork.");
                      return;
                    }
                    setMenuActionBusy("fork");
                    setMenuActionError(null);
                    void forkThread(threadId)
                      .then((forked) => {
                        if (!forked?.id) {
                          throw new Error(
                            "thread/fork did not return a thread id.",
                          );
                        }
                        setHeaderMenuOpen(false);
                        void queryClient.invalidateQueries({
                          queryKey: ["threads", "list"],
                        });
                        void navigate({
                          to: "/t/$threadId",
                          params: { threadId: forked.id },
                        });
                      })
                      .catch((error: unknown) => {
                        setMenuActionError(
                          error instanceof Error
                            ? error.message
                            : "Failed to fork thread.",
                        );
                      })
                      .finally(() => setMenuActionBusy(null));
                  }}
                >
                  {menuActionBusy === "fork" ? "Forking…" : "Fork thread"}
                </button>
                <button
                  className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5 disabled:opacity-60"
                  disabled={menuActionBusy !== null}
                  onClick={() => {
                    if (!threadId) {
                      setMenuActionError("No active thread to rollback.");
                      return;
                    }
                    setMenuActionBusy("rollback");
                    setMenuActionError(null);
                    void rollbackThread({ threadId, numTurns: 1 })
                      .then(() => {
                        setHeaderMenuOpen(false);
                        void queryClient.invalidateQueries({
                          queryKey: ["threads", "read", threadId],
                        });
                      })
                      .catch((error: unknown) => {
                        setMenuActionError(
                          error instanceof Error
                            ? error.message
                            : "Failed to rollback thread.",
                        );
                      })
                      .finally(() => setMenuActionBusy(null));
                  }}
                >
                  {menuActionBusy === "rollback"
                    ? "Rolling back…"
                    : "Rollback last turn"}
                </button>
                <button
                  className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    void navigate({ to: "/plan-summary" });
                  }}
                >
                  Open plan summary ({loadedThreadCount})
                </button>
                <button
                  className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/5"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    void navigate({ to: "/diff" });
                  }}
                >
                  Open diff route
                </button>
                {menuActionError ? (
                  <p className="px-3 py-2 text-[0.65rem] text-rose-300">
                    {menuActionError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
