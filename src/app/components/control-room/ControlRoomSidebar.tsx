import { Link, useMatchRoute } from "@tanstack/react-router";
import { Filter, Folder, Plus, Settings } from "lucide-react";
import { useMemo } from "react";

import { useThreadList } from "@/app/services/cli/useThreads";

export function ControlRoomSidebar() {
  const matchRoute = useMatchRoute();
  const threadMatch = matchRoute({ to: "/threads/$threadId" });
  const selectedThreadId = threadMatch ? threadMatch.threadId : undefined;
  const { projects, threads, providers, sources } = useThreadList({
    limit: 25,
  });

  const recents = useMemo(() => threads.slice(0, 6), [threads]);
  const providerTags = useMemo(
    () => (providers.length ? providers : ["openai"]),
    [providers],
  );
  const sourceTags = useMemo(
    () => (sources.length ? sources : ["cli", "vscode", "app-server"]),
    [sources],
  );

  return (
    <aside className="flex min-h-screen w-60 flex-col border-r border-white/5 bg-ink-900/70 px-4 py-6 backdrop-blur-xl">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">Codex</p>
        <h2 className="font-display text-lg">Thread Control</h2>
      </div>

      <nav className="space-y-2 text-sm">
        <Link
          to="/threads/new"
          className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 hover:border-flare-300"
        >
          <span>New thread</span>
          <span className="text-xs text-ink-400">N</span>
        </Link>
        <Link
          to="/automations"
          className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2 text-ink-300 hover:border-flare-300"
        >
          <span>Automations</span>
          <span className="text-xs text-ink-500">A</span>
        </Link>
        <Link
          to="/skills"
          className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2 text-ink-300 hover:border-flare-300"
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
        <div className="mt-3 space-y-2 text-xs">
          {recents.length ? (
            recents.map((thread) => {
              const isSelected = thread.id === selectedThreadId;
              const showDot =
                thread.status === "needs_review" || thread.status === "running";
              return (
                <Link
                  key={thread.id}
                  to="/threads/$threadId"
                  params={{ threadId: thread.id }}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 transition ${
                    isSelected
                      ? "border-white/20 bg-white/5 text-ink-50"
                      : "border-white/5 text-ink-300"
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
            <button className="rounded-full border border-white/10 p-1 hover:border-flare-300">
              <Plus className="h-3 w-3" />
            </button>
            <button className="rounded-full border border-white/10 p-1 hover:border-flare-300">
              <Filter className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-2 text-xs">
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
            >
              <Folder className="h-3.5 w-3.5 text-ink-400" />
              <div className="min-w-0">
                <p className="truncate text-ink-100">{project.name}</p>
                <p className="truncate text-[0.65rem] text-ink-500">
                  {project.path}
                </p>
              </div>
            </div>
          ))}
          {!projects.length ? (
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-ink-500">
              No workspaces detected.
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-ink-900/60 p-3 text-xs text-ink-300">
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
          to="/settings"
          className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 hover:border-flare-300"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
