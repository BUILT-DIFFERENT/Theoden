import { useQueryClient } from "@tanstack/react-query";
import { Link, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Filter,
  Folder,
  LogOut,
  Plus,
  Settings,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { logoutAccount, startAccountLogin } from "@/app/services/cli/account";
import { useAccount } from "@/app/services/cli/useAccount";
import { useThreadList } from "@/app/services/cli/useThreads";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { useAppUi } from "@/app/state/appUi";
import { useThreadUi } from "@/app/state/threadUi";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import {
  isLikelyWorkspacePath,
  normalizeWorkspacePath,
  workspaceNameFromPath,
} from "@/app/utils/workspace";

function readLoginUrl(result: unknown) {
  if (!result || typeof result !== "object") {
    return null;
  }
  const record = result as Record<string, unknown>;
  const knownKeys = [
    "authUrl",
    "verificationUri",
    "browserUrl",
    "url",
    "authorizeUrl",
  ];
  for (const key of knownKeys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length) {
      return value;
    }
  }
  return null;
}

export function AppSidebar() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setComposerDraft } = useAppUi();
  const { setActiveModal, setReviewOpen } = useThreadUi();
  const { account } = useAccount();
  const matchRoute = useMatchRoute();
  const threadMatch = matchRoute({ to: "/t/$threadId" });
  const selectedThreadId = threadMatch ? threadMatch.threadId : undefined;
  const { selectedWorkspace, setSelectedWorkspace, setWorkspacePickerOpen } =
    useWorkspaceUi();
  const { projects, threads, allThreads } = useThreadList({
    limit: 100,
    workspacePath: selectedWorkspace,
  });
  const { workspaces } = useWorkspaces();
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<
    Record<string, boolean>
  >({});
  const [threadSort, setThreadSort] = useState<"updated" | "title">("updated");
  const [threadVisibility, setThreadVisibility] = useState<"all" | "active">(
    "all",
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
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const threadListParentRef = useRef<HTMLDivElement | null>(null);

  const recents = useMemo(() => threads.slice(0, 6), [threads]);
  const workspaceEntries = workspaces.length
    ? workspaces.map((workspace) => ({
        id: workspace.path,
        name: workspace.name,
        path: workspace.path,
      }))
    : projects.map((project) => ({
        id: project.id,
        name: project.name,
        path: project.path,
      }));
  const workspaceThreadsMap = useMemo(() => {
    const map = new Map<string, typeof allThreads>();
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
  const workspaceTree = useMemo(() => {
    const knownEntries = new Set<string>();
    const entries = workspaceEntries.map((workspace) => {
      const key = normalizeWorkspacePath(workspace.path).toLowerCase();
      knownEntries.add(key);
      return {
        ...workspace,
        key,
        threads: workspaceThreadsMap.get(key) ?? [],
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
      });
    });
    return entries;
  }, [workspaceEntries, workspaceThreadsMap]);
  const visibleWorkspaceTree = useMemo(() => {
    return workspaceTree
      .map((workspace) => {
        const filteredThreads = workspace.threads.filter((thread) => {
          if (threadVisibility === "all") {
            return true;
          }
          return (
            thread.status === "running" ||
            thread.status === "needs_review" ||
            thread.id === selectedThreadId
          );
        });
        const sortedThreads =
          threadSort === "title"
            ? filteredThreads
                .slice()
                .sort((a, b) => a.title.localeCompare(b.title))
            : filteredThreads;
        return {
          ...workspace,
          threads: sortedThreads,
        };
      })
      .filter(
        (workspace) =>
          workspace.threads.length > 0 || threadVisibility === "all",
      );
  }, [selectedThreadId, threadSort, threadVisibility, workspaceTree]);

  const rowVirtualizer = useVirtualizer({
    count: visibleWorkspaceTree.length,
    getScrollElement: () => threadListParentRef.current,
    estimateSize: () => 112,
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
    rowVirtualizer.measure();
  }, [expandedWorkspaces, rowVirtualizer, visibleWorkspaceTree]);

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
      if (action === "logout") {
        await logoutAccount();
        await queryClient.invalidateQueries({ queryKey: ["account", "read"] });
        showAccountMessage("Signed out.");
        return;
      }

      if (action === "login-api-key") {
        const apiKey = window.prompt("Enter OpenAI API key");
        if (!apiKey?.trim()) {
          return;
        }
        const result = await startAccountLogin("apiKey", apiKey.trim());
        const url = readLoginUrl(result);
        if (url) {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      } else {
        const result = await startAccountLogin("chatgpt");
        const url = readLoginUrl(result);
        if (url) {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["account", "read"] });
      showAccountMessage("Sign-in started.");
    } catch (error) {
      setAccountActionError(
        error instanceof Error ? error.message : "Account action failed.",
      );
    } finally {
      setAccountAction(null);
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
    <aside className="flex min-h-screen w-60 flex-col border-r border-white/10 bg-ink-900/70 px-4 py-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">Codex</p>
        <h2 className="font-display text-lg">Navigation</h2>
      </div>

      <nav className="space-y-1 text-sm">
        <Link
          to="/"
          className="flex items-center justify-between rounded-xl px-3 py-2 text-ink-200 transition hover:bg-white/5 hover:text-ink-50"
          onClick={() => {
            setComposerDraft("");
            setReviewOpen(false);
            setActiveModal(null);
          }}
        >
          <span>New thread</span>
          <span className="text-xs text-ink-400">N</span>
        </Link>
        <Link
          to="/automations"
          className="flex items-center justify-between rounded-xl px-3 py-2 text-ink-300 transition hover:bg-white/5 hover:text-ink-50"
        >
          <span>Automations</span>
          <span className="text-xs text-ink-500">A</span>
        </Link>
        <Link
          to="/skills"
          className="flex items-center justify-between rounded-xl px-3 py-2 text-ink-300 transition hover:bg-white/5 hover:text-ink-50"
        >
          <span>Skills</span>
          <span className="text-xs text-ink-500">S</span>
        </Link>
      </nav>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
            Recents
          </p>
          <span className="text-[0.65rem] text-ink-500">
            {recents.length} showing
          </span>
        </div>
        <div className="mt-3 space-y-1 text-xs">
          {recents.length ? (
            recents.map((thread) => {
              const isSelected = thread.id === selectedThreadId;
              const showDot =
                thread.status === "needs_review" || thread.status === "running";
              return (
                <Link
                  key={thread.id}
                  to="/t/$threadId"
                  params={{ threadId: thread.id }}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 transition ${
                    isSelected
                      ? "bg-white/10 text-ink-50"
                      : "text-ink-300 hover:bg-white/5 hover:text-ink-50"
                  }`}
                  onClick={() => {
                    if (isLikelyWorkspacePath(thread.subtitle)) {
                      setSelectedWorkspace(thread.subtitle);
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    {showDot ? (
                      <span className="h-2 w-2 rounded-full bg-sky-400" />
                    ) : (
                      <span className="h-2 w-2 rounded-full border border-white/10" />
                    )}
                    <span className="max-w-[110px] truncate">
                      {thread.title}
                    </span>
                  </div>
                  <span className="text-[0.65rem] text-ink-500">
                    {thread.lastUpdated}
                  </span>
                </Link>
              );
            })
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-ink-500">
              No recent threads.
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
            Threads
          </p>
          <div className="flex items-center gap-2 text-ink-400">
            <button
              className="btn-flat inline-flex items-center gap-1 px-2"
              onClick={() => setWorkspacePickerOpen(true)}
              aria-label="Add workspace"
            >
              <Plus className="h-3 w-3" />
              <span className="text-[0.65rem]">Add</span>
            </button>
            <div className="relative" ref={filterMenuRef}>
              <button
                className="btn-flat inline-flex items-center gap-1 px-2"
                onClick={() => setFilterMenuOpen((open) => !open)}
                aria-label="Thread sort and filter"
              >
                <Filter className="h-3 w-3" />
                <span className="text-[0.65rem]">Sort</span>
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
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div
          ref={threadListParentRef}
          className="codex-scrollbar mt-3 min-h-0 flex-1 overflow-auto"
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
                      className={`mb-1 rounded-xl border text-ink-300 transition ${
                        isSelected
                          ? "border-white/15 bg-white/10"
                          : "border-white/5 bg-black/10"
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-l-xl px-3 py-2 text-left hover:bg-white/5"
                          onClick={() => {
                            setSelectedWorkspace(workspace.path);
                            setExpandedWorkspaces((current) => ({
                              ...current,
                              [workspace.key]: true,
                            }));
                          }}
                        >
                          <Folder className="h-3.5 w-3.5 text-ink-400" />
                          <div className="min-w-0">
                            <p className="truncate text-ink-100">
                              {workspace.name}
                            </p>
                            <p className="truncate text-[0.65rem] text-ink-500">
                              {workspace.path}
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          className="rounded-r-xl border-l border-white/10 px-2 py-2 text-ink-400 hover:bg-white/5 hover:text-ink-200"
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
                            workspace.threads.slice(0, 8).map((thread) => {
                              const isThreadSelected =
                                thread.id === selectedThreadId;
                              return (
                                <Link
                                  key={thread.id}
                                  to="/t/$threadId"
                                  params={{ threadId: thread.id }}
                                  className={`mt-1 flex items-center justify-between rounded-lg px-2 py-1.5 text-[0.7rem] transition ${
                                    isThreadSelected
                                      ? "bg-flare-400/15 text-ink-50"
                                      : "text-ink-300 hover:bg-white/5 hover:text-ink-50"
                                  }`}
                                  onClick={() =>
                                    setSelectedWorkspace(workspace.path)
                                  }
                                >
                                  <span className="truncate">
                                    {thread.title}
                                  </span>
                                  <span className="ml-2 text-ink-500">
                                    {thread.lastUpdated}
                                  </span>
                                </Link>
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
