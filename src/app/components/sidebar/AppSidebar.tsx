import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  EllipsisVertical,
  Filter,
  Folder,
  Inbox,
  LogOut,
  Pin,
  Plus,
  SquarePen,
  Settings,
  UserRound,
  WandSparkles,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  AccountActionCancelledError,
  runAccountAction as performAccountAction,
} from "@/app/services/cli/accountActions";
import { archiveThread, unarchiveThread } from "@/app/services/cli/threads";
import { useAccount } from "@/app/services/cli/useAccount";
import { useThreadList } from "@/app/services/cli/useThreads";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import {
  listInboxItems,
  subscribeAutomationStoreUpdates,
} from "@/app/services/host/automations";
import { useAppUi } from "@/app/state/appUi";
import {
  setSidebarThreadAlias,
  toggleSidebarThreadPinned,
  useSidebarThreadMetadataMap,
} from "@/app/state/sidebarThreadMetadata";
import {
  loadStoredSidebarUi,
  type SidebarGroupMode,
  storeSidebarUi,
  type SidebarThreadSort,
  type SidebarThreadVisibility,
} from "@/app/state/sidebarUi";
import { useThreadUi } from "@/app/state/threadUi";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import type { ThreadSummary } from "@/app/types";
import { isTauri } from "@/app/utils/tauri";
import {
  normalizeWorkspacePath,
  workspaceNameFromPath,
} from "@/app/utils/workspace";

type WorkspaceGroup = {
  id: string;
  name: string;
  path: string;
  key: string;
  threads: ThreadSummary[];
  kind: "workspace" | "recency";
};

function threadDisplayTitle(
  thread: ThreadSummary,
  metadataMap: Record<string, { alias?: string }>,
) {
  const alias = metadataMap[thread.id]?.alias?.trim();
  return alias && alias.length ? alias : thread.title;
}

function sortThreadsForSidebar(
  threads: ThreadSummary[],
  threadSort: SidebarThreadSort,
  metadataMap: Record<string, { pinned?: boolean; alias?: string }>,
) {
  return threads.slice().sort((left, right) => {
    const leftPinned = metadataMap[left.id]?.pinned === true ? 1 : 0;
    const rightPinned = metadataMap[right.id]?.pinned === true ? 1 : 0;
    if (leftPinned !== rightPinned) {
      return rightPinned - leftPinned;
    }
    if (threadSort === "title") {
      return threadDisplayTitle(left, metadataMap).localeCompare(
        threadDisplayTitle(right, metadataMap),
      );
    }
    return 0;
  });
}

export function AppSidebar() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setComposerDraft } = useAppUi();
  const { setActiveModal, setReviewOpen } = useThreadUi();
  const { account } = useAccount();
  const matchRoute = useMatchRoute();
  const threadMatch = matchRoute({ to: "/t/$threadId" });
  const newThreadMatch = matchRoute({ to: "/" });
  const inboxMatch = matchRoute({ to: "/inbox" });
  const automationsMatch = matchRoute({ to: "/automations" });
  const skillsMatch = matchRoute({ to: "/skills" });
  const selectedThreadId = threadMatch ? threadMatch.threadId : undefined;
  const { selectedWorkspace, setSelectedWorkspace, setWorkspacePickerOpen } =
    useWorkspaceUi();
  const { projects, allThreads } = useThreadList({
    limit: 100,
    workspacePath: selectedWorkspace,
  });
  const { workspaces } = useWorkspaces();
  const [initialSidebarState] = useState(() => loadStoredSidebarUi());
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<
    Record<string, boolean>
  >(() =>
    initialSidebarState.expandedWorkspaceKeys.reduce<Record<string, boolean>>(
      (accumulator, key) => {
        accumulator[key] = true;
        return accumulator;
      },
      {},
    ),
  );
  const [threadSort, setThreadSort] = useState<SidebarThreadSort>(
    initialSidebarState.threadSort,
  );
  const [threadVisibility, setThreadVisibility] =
    useState<SidebarThreadVisibility>(initialSidebarState.threadVisibility);
  const [groupMode, setGroupMode] = useState<SidebarGroupMode>(
    initialSidebarState.groupMode,
  );
  const [threadListScrollTop, setThreadListScrollTop] = useState(
    initialSidebarState.scrollTop,
  );
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountActionMessage, setAccountActionMessage] = useState<
    string | null
  >(null);
  const [accountActionError, setAccountActionError] = useState<string | null>(
    null,
  );
  const [accountAction, setAccountAction] = useState<
    "login-chatgpt" | "login-api-key" | "logout" | null
  >(null);
  const [threadActionError, setThreadActionError] = useState<string | null>(
    null,
  );
  const [openThreadMenuId, setOpenThreadMenuId] = useState<string | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const threadListParentRef = useRef<HTMLDivElement | null>(null);
  const restoredScrollRef = useRef(false);
  const sidebarThreadMetadata = useSidebarThreadMetadataMap();
  const isDesktop = isTauri();
  const inboxItemsQuery = useQuery({
    queryKey: ["host", "inbox-items"],
    queryFn: listInboxItems,
    enabled: isDesktop,
    refetchOnWindowFocus: isDesktop,
  });
  const unreadInboxCount = (inboxItemsQuery.data ?? []).filter(
    (item) => item.readAt === null,
  ).length;

  const workspaceEntries = useMemo<
    Array<{ id: string; name: string; path: string }>
  >(
    () =>
      workspaces.length
        ? workspaces.map((workspace) => ({
            id: workspace.path,
            name: workspace.name,
            path: workspace.path,
          }))
        : projects.map((project) => ({
            id: project.id,
            name: project.name,
            path: project.path,
          })),
    [projects, workspaces],
  );
  const workspaceThreadsMap = useMemo<Map<string, ThreadSummary[]>>(() => {
    const map = new Map<string, ThreadSummary[]>();
    allThreads.forEach((thread) => {
      const key = normalizeWorkspacePath(thread.subtitle).toLowerCase();
      const entries = map.get(key);
      if (entries) {
        entries.push(thread);
        return;
      }
      map.set(key, [thread]);
    });
    return map;
  }, [allThreads]);
  const workspaceTree = useMemo<WorkspaceGroup[]>(() => {
    const knownEntries = new Set<string>();
    const entries = workspaceEntries.map((workspace) => {
      const key = normalizeWorkspacePath(workspace.path).toLowerCase();
      knownEntries.add(key);
      return {
        ...workspace,
        key,
        threads: workspaceThreadsMap.get(key) ?? [],
        kind: "workspace" as const,
      };
    });
    workspaceThreadsMap.forEach((threadsForWorkspace, key) => {
      if (knownEntries.has(key) || !threadsForWorkspace.length) {
        return;
      }
      const path = threadsForWorkspace[0]?.subtitle;
      if (!path) {
        return;
      }
      entries.push({
        id: path,
        path,
        key,
        name: workspaceNameFromPath(path),
        threads: threadsForWorkspace,
        kind: "workspace",
      });
    });
    return entries;
  }, [workspaceEntries, workspaceThreadsMap]);
  const recencyTree = useMemo<WorkspaceGroup[]>(() => {
    return [
      {
        id: "recency",
        name: "Recent threads",
        path: "recency",
        key: "recency",
        threads: allThreads,
        kind: "recency",
      },
    ];
  }, [allThreads]);
  const visibleWorkspaceTree = useMemo<WorkspaceGroup[]>(() => {
    const sourceTree = groupMode === "recency" ? recencyTree : workspaceTree;
    const filterByVisibility = (thread: ThreadSummary) => {
      if (threadVisibility === "all") {
        return true;
      }
      return (
        thread.status === "running" ||
        thread.status === "needs_review" ||
        thread.id === selectedThreadId
      );
    };

    return sourceTree
      .map((workspace) => {
        const filteredThreads = workspace.threads.filter(filterByVisibility);
        return {
          ...workspace,
          threads: sortThreadsForSidebar(
            filteredThreads,
            threadSort,
            sidebarThreadMetadata,
          ),
        };
      })
      .filter(
        (workspace) =>
          workspace.threads.length > 0 || threadVisibility === "all",
      );
  }, [
    groupMode,
    recencyTree,
    selectedThreadId,
    sidebarThreadMetadata,
    threadSort,
    threadVisibility,
    workspaceTree,
  ]);
  const expandedWorkspaceKeys = useMemo(
    () =>
      Object.entries(expandedWorkspaces)
        .filter(([, isExpanded]) => isExpanded)
        .map(([key]) => key)
        .sort(),
    [expandedWorkspaces],
  );
  const visibleWorkspaceCount = visibleWorkspaceTree.length;

  const rowVirtualizer = useVirtualizer({
    count: visibleWorkspaceTree.length,
    getScrollElement: () => threadListParentRef.current,
    estimateSize: () => 92,
    overscan: 8,
  });

  useEffect(() => {
    if (!selectedWorkspace) {
      return;
    }
    const key = normalizeWorkspacePath(selectedWorkspace).toLowerCase();
    setExpandedWorkspaces((current) => {
      if (current[key]) {
        return current;
      }
      return { ...current, [key]: true };
    });
  }, [selectedWorkspace]);

  useEffect(() => {
    if (!filterMenuOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (filterMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setFilterMenuOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [filterMenuOpen]);

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (accountMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setAccountMenuOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!openThreadMenuId) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-thread-menu='true']")) {
        return;
      }
      setOpenThreadMenuId(null);
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [openThreadMenuId]);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }
    let unlisten: (() => void) | null = null;
    void subscribeAutomationStoreUpdates(() => {
      void queryClient.invalidateQueries({
        queryKey: ["host", "inbox-items"],
      });
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => {
      unlisten?.();
    };
  }, [isDesktop, queryClient]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      rowVirtualizer.measure();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expandedWorkspaceKeys, rowVirtualizer, visibleWorkspaceCount]);

  useEffect(() => {
    if (restoredScrollRef.current) {
      return;
    }
    if (!threadListScrollTop) {
      restoredScrollRef.current = true;
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      if (threadListParentRef.current) {
        threadListParentRef.current.scrollTop = threadListScrollTop;
      }
      restoredScrollRef.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [threadListScrollTop]);

  useEffect(() => {
    storeSidebarUi({
      threadSort,
      threadVisibility,
      groupMode,
      expandedWorkspaceKeys,
      scrollTop: threadListScrollTop,
    });
  }, [
    expandedWorkspaceKeys,
    groupMode,
    threadListScrollTop,
    threadSort,
    threadVisibility,
  ]);

  const toggleWorkspaceExpanded = (workspacePath: string) => {
    const key = normalizeWorkspacePath(workspacePath).toLowerCase();
    setExpandedWorkspaces((current) => ({
      ...current,
      [key]: !(current[key] ?? false),
    }));
  };

  const showAccountMessage = (message: string) => {
    setAccountActionMessage(message);
    window.setTimeout(() => setAccountActionMessage(null), 2500);
  };

  const runAccountAction = async (
    action: "login-chatgpt" | "login-api-key" | "logout",
  ) => {
    setAccountAction(action);
    setAccountActionError(null);
    try {
      const message = await performAccountAction(action, {
        promptApiKey: () => window.prompt("Enter OpenAI API key"),
        openExternal: (url) => {
          window.open(url, "_blank", "noopener,noreferrer");
        },
        refreshAccount: async () => {
          await queryClient.invalidateQueries({
            queryKey: ["account", "read"],
          });
        },
      });
      showAccountMessage(message);
    } catch (error) {
      if (error instanceof AccountActionCancelledError) {
        return;
      }
      setAccountActionError(
        error instanceof Error ? error.message : "Account action failed.",
      );
    } finally {
      setAccountAction(null);
    }
  };

  const openThread = async (
    threadId: string,
    workspacePath: string | null,
    withChanges = false,
  ) => {
    if (workspacePath) {
      setSelectedWorkspace(workspacePath);
    }
    setReviewOpen(withChanges);
    await navigate({
      to: "/t/$threadId",
      params: { threadId },
    });
  };

  const handleThreadActionError = (
    error: unknown,
    fallback: string,
  ): string => {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }
    return fallback;
  };

  const handleToggleArchive = async (
    thread: ThreadSummary,
    isArchived: boolean,
  ) => {
    setThreadActionError(null);
    try {
      if (isArchived) {
        await unarchiveThread(thread.id);
      } else {
        await archiveThread(thread.id);
      }
      await queryClient.invalidateQueries({ queryKey: ["threads", "list"] });
      await queryClient.invalidateQueries({
        queryKey: ["threads", "read", thread.id],
      });
    } catch (error) {
      setThreadActionError(
        handleThreadActionError(error, "Failed to update archive status."),
      );
    } finally {
      setOpenThreadMenuId(null);
    }
  };

  const isAuthenticated = account?.isAuthenticated ?? false;
  const accountEmail =
    account?.email ?? (isAuthenticated ? "Signed in" : "Not signed in");
  const accountOrganization =
    account?.organizationName ??
    (account?.authMethod === "apiKey" ? "API key" : "Personal workspace");
  const accountAvatar = accountEmail.slice(0, 1).toUpperCase() || "?";

  return (
    <aside className="flex min-h-0 w-[240px] flex-col border-r border-white/10 bg-[#1a2649]/72 px-3 py-4 backdrop-blur-xl">
      <nav className="space-y-1 text-[0.85rem]">
        <Link
          to="/"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 transition ${
            newThreadMatch
              ? "bg-white/14 text-ink-50"
              : "text-ink-200 hover:bg-white/8 hover:text-ink-50"
          }`}
          onClick={() => {
            setComposerDraft("");
            setReviewOpen(false);
            setActiveModal(null);
          }}
        >
          <SquarePen className="h-4 w-4 text-ink-400" />
          <span>New thread</span>
        </Link>
        <Link
          to="/inbox"
          className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition ${
            inboxMatch
              ? "bg-white/14 text-ink-50"
              : "text-ink-300 hover:bg-white/8 hover:text-ink-50"
          }`}
        >
          <span className="flex items-center gap-3">
            <Inbox className="h-4 w-4 text-ink-400" />
            <span>Inbox</span>
          </span>
          {unreadInboxCount > 0 ? (
            <span className="rounded-full border border-sky-300/40 bg-sky-500/10 px-2 py-0.5 text-[0.65rem] text-sky-100">
              {unreadInboxCount}
            </span>
          ) : null}
        </Link>
        <Link
          to="/automations"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 transition ${
            automationsMatch
              ? "bg-white/14 text-ink-50"
              : "text-ink-300 hover:bg-white/8 hover:text-ink-50"
          }`}
        >
          <Workflow className="h-4 w-4 text-ink-400" />
          <span>Automations</span>
        </Link>
        <Link
          to="/skills"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 transition ${
            skillsMatch
              ? "bg-white/14 text-ink-50"
              : "text-ink-300 hover:bg-white/8 hover:text-ink-50"
          }`}
        >
          <WandSparkles className="h-4 w-4 text-ink-400" />
          <span>Skills</span>
        </Link>
      </nav>

      <div className="mt-6 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between">
          <p className="text-[0.65rem] uppercase tracking-[0.25em] text-ink-400">
            Threads
          </p>
          <div className="flex items-center gap-1.5 text-ink-400">
            <button
              className="btn-flat inline-flex h-7 w-7 items-center justify-center"
              onClick={() => setWorkspacePickerOpen(true)}
              aria-label="Add workspace"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <div className="relative" ref={filterMenuRef}>
              <button
                className="btn-flat inline-flex h-7 w-7 items-center justify-center"
                onClick={() => setFilterMenuOpen((open) => !open)}
                aria-label="Thread sort and filter"
              >
                <Filter className="h-3.5 w-3.5" />
              </button>
              {filterMenuOpen ? (
                <div className="surface-panel absolute right-0 top-8 z-30 w-52 p-2 text-[0.7rem]">
                  <p className="px-2 pb-1 text-[0.65rem] uppercase tracking-[0.2em] text-ink-500">
                    Sort by
                  </p>
                  <button
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-ink-200 hover:bg-white/5"
                    onClick={() => {
                      setThreadSort("updated");
                      setFilterMenuOpen(false);
                    }}
                  >
                    Updated
                    {threadSort === "updated" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-300" />
                    ) : null}
                  </button>
                  <button
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-ink-200 hover:bg-white/5"
                    onClick={() => {
                      setThreadSort("title");
                      setFilterMenuOpen(false);
                    }}
                  >
                    Title
                    {threadSort === "title" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-300" />
                    ) : null}
                  </button>
                  <p className="px-2 pb-1 pt-2 text-[0.65rem] uppercase tracking-[0.2em] text-ink-500">
                    Show
                  </p>
                  <button
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-ink-200 hover:bg-white/5"
                    onClick={() => {
                      setThreadVisibility("all");
                      setFilterMenuOpen(false);
                    }}
                  >
                    All threads
                    {threadVisibility === "all" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-300" />
                    ) : null}
                  </button>
                  <button
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-ink-200 hover:bg-white/5"
                    onClick={() => {
                      setThreadVisibility("active");
                      setFilterMenuOpen(false);
                    }}
                  >
                    Running or review
                    {threadVisibility === "active" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-300" />
                    ) : null}
                  </button>
                  <p className="px-2 pb-1 pt-2 text-[0.65rem] uppercase tracking-[0.2em] text-ink-500">
                    Group
                  </p>
                  <button
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-ink-200 hover:bg-white/5"
                    onClick={() => {
                      setGroupMode("workspace");
                      setFilterMenuOpen(false);
                    }}
                  >
                    Group by workspace
                    {groupMode === "workspace" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-300" />
                    ) : null}
                  </button>
                  <button
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-ink-200 hover:bg-white/5"
                    onClick={() => {
                      setGroupMode("recency");
                      setFilterMenuOpen(false);
                    }}
                  >
                    Group by recency
                    {groupMode === "recency" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-300" />
                    ) : null}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div
          ref={threadListParentRef}
          className="codex-scrollbar mt-3 min-h-0 flex-1 overflow-auto"
          onScroll={(event) =>
            setThreadListScrollTop(event.currentTarget.scrollTop)
          }
        >
          {visibleWorkspaceTree.length ? (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const workspace = visibleWorkspaceTree[virtualRow.index];
                const isSelected =
                  workspace.kind === "workspace" &&
                  selectedWorkspace &&
                  workspace.path.toLowerCase() ===
                    selectedWorkspace.toLowerCase();
                const isExpanded =
                  expandedWorkspaces[workspace.key] ?? Boolean(isSelected);

                return (
                  <div
                    key={workspace.id}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    style={{
                      left: 0,
                      position: "absolute",
                      top: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                      width: "100%",
                    }}
                  >
                    <div
                      className={`mb-2 rounded-xl border text-ink-300 transition ${
                        isSelected
                          ? "border-white/18 bg-white/10"
                          : "border-white/10 bg-black/12"
                      }`}
                    >
                      <div className="flex items-center justify-between px-3 py-2">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left hover:text-ink-50"
                          onClick={() => {
                            if (workspace.kind === "workspace") {
                              setSelectedWorkspace(workspace.path);
                            }
                            setExpandedWorkspaces((current) => ({
                              ...current,
                              [workspace.key]: true,
                            }));
                          }}
                        >
                          <Folder className="h-3.5 w-3.5 text-ink-400" />
                          <p className="truncate text-[0.8rem] text-ink-100">
                            {workspace.name}
                          </p>
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1 text-ink-400 hover:bg-white/5 hover:text-ink-200"
                          onClick={() =>
                            toggleWorkspaceExpanded(workspace.path)
                          }
                          aria-label={
                            isExpanded
                              ? "Collapse workspace threads"
                              : "Expand workspace threads"
                          }
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                      {isExpanded ? (
                        <div className="border-t border-white/10 px-2 pb-2 pt-1">
                          {workspace.threads.length ? (
                            workspace.threads.map((thread) => {
                              const isThreadSelected =
                                thread.id === selectedThreadId;
                              const metadata =
                                sidebarThreadMetadata[thread.id] ?? {};
                              const displayTitle = threadDisplayTitle(
                                thread,
                                sidebarThreadMetadata,
                              );
                              const isArchived = thread.archived === true;
                              const showDot =
                                thread.status === "needs_review" ||
                                thread.status === "running";
                              const changeSummary = thread.changeSummary;
                              const showChanges =
                                changeSummary &&
                                (changeSummary.additions > 0 ||
                                  changeSummary.deletions > 0);
                              return (
                                <div
                                  key={thread.id}
                                  className={`mt-1 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[0.7rem] transition ${
                                    isThreadSelected
                                      ? "bg-flare-400/20 text-ink-50"
                                      : "text-ink-300 hover:bg-white/8 hover:text-ink-50"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                                    onClick={() => {
                                      void openThread(
                                        thread.id,
                                        workspace.kind === "workspace"
                                          ? workspace.path
                                          : null,
                                      );
                                    }}
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      {showDot ? (
                                        <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                                      ) : (
                                        <span className="h-1.5 w-1.5 rounded-full border border-white/10" />
                                      )}
                                      <span className="truncate">
                                        {displayTitle}
                                      </span>
                                      {metadata.pinned ? (
                                        <Pin className="h-3 w-3 text-amber-200" />
                                      ) : null}
                                    </div>
                                    <div className="flex items-center gap-2 text-[0.65rem] text-ink-500">
                                      {showChanges ? (
                                        <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[0.6rem]">
                                          +{changeSummary.additions} -
                                          {changeSummary.deletions}
                                        </span>
                                      ) : null}
                                      <span>{thread.lastUpdated}</span>
                                    </div>
                                  </button>
                                  <div
                                    className="relative"
                                    data-thread-menu="true"
                                  >
                                    <button
                                      type="button"
                                      className="rounded-lg p-1 text-ink-400 hover:bg-white/8 hover:text-ink-100"
                                      onClick={() => {
                                        setOpenThreadMenuId((current) =>
                                          current === thread.id
                                            ? null
                                            : thread.id,
                                        );
                                      }}
                                      aria-label="Thread actions"
                                    >
                                      <EllipsisVertical className="h-3.5 w-3.5" />
                                    </button>
                                    {openThreadMenuId === thread.id ? (
                                      <div className="surface-panel absolute right-0 top-7 z-40 w-44 p-1 text-[0.65rem] text-ink-200">
                                        <button
                                          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-white/5"
                                          onClick={() => {
                                            toggleSidebarThreadPinned(
                                              thread.id,
                                            );
                                            setOpenThreadMenuId(null);
                                          }}
                                        >
                                          {metadata.pinned ? "Unpin" : "Pin"}
                                          <Pin className="h-3 w-3 text-ink-400" />
                                        </button>
                                        <button
                                          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-white/5"
                                          onClick={() => {
                                            const nextAlias = window.prompt(
                                              "Thread display alias",
                                              metadata.alias ?? thread.title,
                                            );
                                            if (nextAlias === null) {
                                              return;
                                            }
                                            const trimmed = nextAlias.trim();
                                            setSidebarThreadAlias(
                                              thread.id,
                                              trimmed.length
                                                ? trimmed
                                                : undefined,
                                            );
                                            setOpenThreadMenuId(null);
                                          }}
                                        >
                                          Rename
                                          <SquarePen className="h-3 w-3 text-ink-400" />
                                        </button>
                                        <button
                                          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-white/5"
                                          onClick={() => {
                                            void handleToggleArchive(
                                              thread,
                                              isArchived,
                                            );
                                          }}
                                        >
                                          {isArchived ? "Unarchive" : "Archive"}
                                          {isArchived ? (
                                            <ArchiveRestore className="h-3 w-3 text-ink-400" />
                                          ) : (
                                            <Archive className="h-3 w-3 text-ink-400" />
                                          )}
                                        </button>
                                        <button
                                          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-white/5"
                                          onClick={() => {
                                            setOpenThreadMenuId(null);
                                            void openThread(
                                              thread.id,
                                              workspace.kind === "workspace"
                                                ? workspace.path
                                                : null,
                                              true,
                                            );
                                          }}
                                        >
                                          Open changes
                                          <ChevronRight className="h-3 w-3 text-ink-400" />
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="mt-1 rounded-lg px-2 py-1.5 text-[0.65rem] text-ink-500">
                              No threads yet.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-ink-500">
              No workspaces detected.
            </div>
          )}
        </div>
        {threadActionError ? (
          <p className="mt-2 text-[0.65rem] text-rose-300">
            {threadActionError}
          </p>
        ) : null}
      </div>

      <div className="mt-4 space-y-2 pt-4">
        <Link
          to="/settings/$section"
          params={{ section: "general" }}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-ink-400 transition hover:bg-white/5 hover:text-ink-50"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </Link>
        <div className="relative" ref={accountMenuRef}>
          <button
            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-xs text-ink-200 transition hover:border-flare-300"
            onClick={() => setAccountMenuOpen((open) => !open)}
          >
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/30 text-[0.65rem] uppercase">
                {accountAvatar}
              </div>
              <div className="min-w-0">
                <p className="truncate">{accountEmail}</p>
                <p className="truncate text-[0.65rem] text-ink-500">
                  {accountOrganization}
                </p>
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-ink-500" />
          </button>
          {accountMenuOpen ? (
            <div className="surface-panel absolute bottom-11 left-0 z-30 w-64 p-2 text-[0.7rem] text-ink-200">
              <button
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-white/5"
                onClick={() => {
                  setAccountMenuOpen(false);
                  void navigate({
                    to: "/settings/$section",
                    params: { section: "general" },
                  });
                }}
              >
                <Settings className="h-3.5 w-3.5 text-ink-400" />
                Open settings
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-white/5"
                onClick={() => {
                  window.open(
                    "https://developers.openai.com/codex/",
                    "_blank",
                    "noopener,noreferrer",
                  );
                }}
              >
                <BookOpen className="h-3.5 w-3.5 text-ink-400" />
                Documentation
              </button>
              {isAuthenticated ? (
                <button
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-white/5 disabled:opacity-60"
                  onClick={() => {
                    void runAccountAction("logout");
                  }}
                  disabled={accountAction !== null}
                >
                  <LogOut className="h-3.5 w-3.5 text-ink-400" />
                  {accountAction === "logout" ? "Signing out…" : "Sign out"}
                </button>
              ) : (
                <>
                  <button
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-white/5 disabled:opacity-60"
                    onClick={() => {
                      void runAccountAction("login-chatgpt");
                    }}
                    disabled={accountAction !== null}
                  >
                    <UserRound className="h-3.5 w-3.5 text-ink-400" />
                    {accountAction === "login-chatgpt"
                      ? "Starting sign in…"
                      : "Sign in with ChatGPT"}
                  </button>
                  <button
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-white/5 disabled:opacity-60"
                    onClick={() => {
                      void runAccountAction("login-api-key");
                    }}
                    disabled={accountAction !== null}
                  >
                    <Plus className="h-3.5 w-3.5 text-ink-400" />
                    Sign in with API key
                  </button>
                </>
              )}
              {accountActionMessage ? (
                <p className="px-3 py-2 text-[0.65rem] text-emerald-300">
                  {accountActionMessage}
                </p>
              ) : null}
              {accountActionError ? (
                <p className="px-3 py-2 text-[0.65rem] text-rose-300">
                  {accountActionError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
