import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  Filter,
  Folder,
  Plus,
  Settings,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useThreadList } from "@/app/services/cli/useThreads";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import {
  normalizeWorkspacePath,
  workspaceNameFromPath,
} from "@/app/utils/workspace";

export function AppSidebar() {
  const matchRoute = useMatchRoute();
  const threadMatch = matchRoute({ to: "/t/$threadId" });
  const selectedThreadId = threadMatch ? threadMatch.threadId : undefined;
  const { selectedWorkspace, setSelectedWorkspace, setWorkspacePickerOpen } =
    useWorkspaceUi();
  const { projects, threads, allThreads, providers, sources } = useThreadList({
    limit: 25,
    workspacePath: selectedWorkspace,
  });
  const { workspaces } = useWorkspaces();
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<
    Record<string, boolean>
  >({});

  const recents = useMemo(() => threads.slice(0, 6), [threads]);
  const providerTags = useMemo(
    () => (providers.length ? providers : ["openai"]),
    [providers],
  );
  const sourceTags = useMemo(
    () => (sources.length ? sources : ["cli", "vscode", "app-server"]),
    [sources],
  );

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

  const toggleWorkspaceExpanded = (workspacePath: string) => {
    const key = normalizeWorkspacePath(workspacePath).toLowerCase();
    setExpandedWorkspaces((current) => ({
      ...current,
      [key]: !(current[key] ?? false),
    }));
  };

  return (
    <aside className="flex min-h-screen w-60 flex-col border-r border-white/5 bg-black/20 px-4 py-6 backdrop-blur-xl">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">Codex</p>
        <h2 className="font-display text-lg">Navigation</h2>
      </div>

      <nav className="space-y-1 text-sm">
        <Link
          to="/"
          className="flex items-center justify-between rounded-xl px-3 py-2 text-ink-200 transition hover:bg-white/5 hover:text-ink-50"
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

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
            Threads
          </p>
          <div className="flex items-center gap-2 text-ink-400">
            <button
              className="rounded-full border border-white/10 p-1 hover:border-flare-300"
              onClick={() => setWorkspacePickerOpen(true)}
            >
              <Plus className="h-3 w-3" />
            </button>
            <button className="rounded-full border border-white/10 p-1 hover:border-flare-300">
              <Filter className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-1 text-xs">
          {workspaceTree.map((workspace) => {
            const isSelected =
              selectedWorkspace &&
              workspace.path.toLowerCase() === selectedWorkspace.toLowerCase();
            const isExpanded = expandedWorkspaces[workspace.key] ?? isSelected;
            return (
              <div
                key={workspace.id}
                className={`rounded-xl border text-ink-300 transition ${
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
                      <p className="truncate text-ink-100">{workspace.name}</p>
                      <p className="truncate text-[0.65rem] text-ink-500">
                        {workspace.path}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="rounded-r-xl border-l border-white/10 px-2 py-2 text-ink-400 hover:bg-white/5 hover:text-ink-200"
                    onClick={() => toggleWorkspaceExpanded(workspace.path)}
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
                      workspace.threads.slice(0, 4).map((thread) => {
                        const isThreadSelected = thread.id === selectedThreadId;
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
                            onClick={() => setSelectedWorkspace(workspace.path)}
                          >
                            <span className="truncate">{thread.title}</span>
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
            );
          })}
          {!workspaceTree.length ? (
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-ink-500">
              No workspaces detected.
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/5 bg-black/20 p-3 text-xs text-ink-300">
        <p className="text-[0.65rem] uppercase tracking-[0.3em] text-ink-500">
          Providers
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {providerTags.map((provider) => (
            <span
              key={provider}
              className="rounded-full border border-white/10 px-2 py-0.5"
            >
              {provider}
            </span>
          ))}
          {sourceTags.map((source) => (
            <span
              key={source}
              className="rounded-full border border-white/10 px-2 py-0.5 text-ink-400"
            >
              {source}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-6 text-xs text-ink-400">
        <Link
          to="/settings/$section"
          params={{ section: "general" }}
          className="flex items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-white/5 hover:text-ink-50"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
