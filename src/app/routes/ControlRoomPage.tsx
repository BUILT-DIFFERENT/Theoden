import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { useActiveRuns } from "@/app/services/cli/useActiveRuns";
import { useCloudTasks } from "@/app/services/cli/useCloudTasks";
import { useThreadList } from "@/app/services/cli/useThreads";

export function ControlRoomPage() {
  const [search, setSearch] = useState("");
  const { threads, allThreads, hasMore, loadMore, isFetchingMore } =
    useThreadList({ search, limit: 25 });
  const activeRuns = useActiveRuns(allThreads);
  const {
    tasks,
    isLoading: tasksLoading,
    refetch: refetchTasks,
  } = useCloudTasks({ limit: 6 });
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Live Runs
            </p>
            <h2 className="font-display text-xl">Parallel agents in flight</h2>
          </div>
          <button className="rounded-full border border-white/10 px-4 py-2 text-xs hover:border-flare-300">
            New run
          </button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {activeRuns.length ? (
            activeRuns.map((run) => (
              <div
                key={run.id}
                className="rounded-xl border border-white/10 bg-black/20 p-4"
              >
                <p className="text-sm text-ink-100">{run.title}</p>
                <p className="text-xs text-ink-400">{run.statusLabel}</p>
                <p className="mt-2 text-xs text-ink-300">
                  Project: {run.projectId}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-ink-400">
              No active runs yet.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Cloud Tasks
            </p>
            <h2 className="font-display text-xl">Background web runs</h2>
          </div>
          <button
            className="rounded-full border border-white/10 px-4 py-2 text-xs hover:border-flare-300"
            onClick={() => void refetchTasks()}
            disabled={tasksLoading}
          >
            Refresh
          </button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {tasksLoading ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-ink-400">
              Loading cloud tasks…
            </div>
          ) : tasks.length ? (
            tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-ink-100">
                    {task.title ?? "Cloud task"}
                  </p>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[0.65rem] text-ink-300">
                    {task.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-400">{task.environment}</p>
                <p className="mt-2 text-xs text-ink-300">
                  Updated {task.updatedAt}
                </p>
                {typeof task.filesChanged === "number" ? (
                  <p className="mt-2 text-xs text-ink-400">
                    {task.filesChanged} files · +{task.linesAdded ?? 0} / -
                    {task.linesRemoved ?? 0}
                  </p>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-ink-400">
              No cloud tasks yet.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Threads
            </p>
            <h2 className="font-display text-xl">Recent investigations</h2>
          </div>
          <Link
            to="/threads"
            className="rounded-full border border-white/10 px-4 py-2 text-xs hover:border-flare-300"
          >
            View all
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search threads"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 focus:border-flare-300 focus:outline-none md:w-64"
          />
          {search ? (
            <button
              className="rounded-full border border-white/10 px-3 py-1 text-xs hover:border-flare-300"
              onClick={() => setSearch("")}
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="mt-4 space-y-3">
          {threads.length ? (
            threads.map((thread) => (
              <div
                key={thread.id}
                className="rounded-xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-ink-100">{thread.title}</p>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-ink-300">
                    {thread.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-400">{thread.subtitle}</p>
                <p className="mt-2 text-xs text-ink-300">
                  Updated {thread.lastUpdated}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-ink-400">
              {search ? "No threads match your search." : "No threads yet."}
            </div>
          )}
        </div>
        {hasMore ? (
          <div className="mt-4">
            <button
              className="rounded-full border border-white/10 px-4 py-2 text-xs hover:border-flare-300"
              onClick={() => void loadMore()}
              disabled={isFetchingMore}
            >
              {isFetchingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
