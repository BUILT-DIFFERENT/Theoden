import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { useActiveRuns } from "@/app/services/cli/useActiveRuns";
import { useThreadList } from "@/app/services/cli/useThreads";

export function ControlRoomSidebar() {
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [providerFilters, setProviderFilters] = useState<string[]>([]);
  const [sourceFilters, setSourceFilters] = useState<string[]>([]);
  const {
    projects,
    threads,
    allThreads,
    providers,
    sources,
    hasMore,
    loadMore,
    isFetchingMore,
  } = useThreadList({
    archived: archivedOnly ? true : undefined,
    modelProviders: providerFilters,
    sourceKinds: sourceFilters,
    limit: 25,
  });
  const activeRuns = useActiveRuns(allThreads);
  const hasActiveRuns = activeRuns.length > 0;
  const hasFilters =
    archivedOnly || providerFilters.length > 0 || sourceFilters.length > 0;

  const toggleFilter = (
    value: string,
    setValue: (updater: (current: string[]) => string[]) => void,
  ) => {
    setValue((current) => {
      if (current.includes(value)) {
        return current.filter((item) => item !== value);
      }
      return [...current, value];
    });
  };

  const providerOptions = useMemo(
    () => (providers.length ? providers : ["openai"]),
    [providers],
  );
  const sourceOptions = useMemo(
    () => (sources.length ? sources : ["cli", "vscode", "app-server"]),
    [sources],
  );

  return (
    <aside className="w-72 border-r border-white/5 bg-ink-900/60 px-4 py-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">Codex</p>
        <h2 className="font-display text-lg">Situation Room</h2>
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-ink-900/70 p-4 shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
          Active
        </p>
        <div className="mt-3 space-y-3 text-sm">
          {hasActiveRuns ? (
            activeRuns.map((run) => (
              <div
                key={run.id}
                className="rounded-xl border border-white/5 bg-black/20 p-3"
              >
                <p className="text-ink-100">{run.title}</p>
                <p className="text-xs text-ink-400">{run.statusLabel}</p>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-white/5 bg-black/20 p-3 text-xs text-ink-400">
              No active runs.
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-ink-900/70 p-4 shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
          Filters
        </p>
        <div className="mt-3 space-y-3 text-xs text-ink-300">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-flare-300"
              checked={archivedOnly}
              onChange={(event) => setArchivedOnly(event.target.checked)}
            />
            Archived only
          </label>
          <div className="space-y-2">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-ink-500">
              Providers
            </p>
            <div className="flex flex-wrap gap-2">
              {providerOptions.map((provider) => {
                const active = providerFilters.includes(provider);
                return (
                  <button
                    key={provider}
                    className={`rounded-full border px-2 py-1 text-[0.65rem] ${
                      active
                        ? "border-flare-300 text-ink-50"
                        : "border-white/10 text-ink-300"
                    }`}
                    onClick={() => toggleFilter(provider, setProviderFilters)}
                  >
                    {provider}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-ink-500">
              Sources
            </p>
            <div className="flex flex-wrap gap-2">
              {sourceOptions.map((source) => {
                const active = sourceFilters.includes(source);
                return (
                  <button
                    key={source}
                    className={`rounded-full border px-2 py-1 text-[0.65rem] ${
                      active
                        ? "border-flare-300 text-ink-50"
                        : "border-white/10 text-ink-300"
                    }`}
                    onClick={() => toggleFilter(source, setSourceFilters)}
                  >
                    {source}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between text-[0.65rem] text-ink-500">
            <span>{threads.length} threads</span>
            {hasFilters ? (
              <button
                className="rounded-full border border-white/10 px-2 py-0.5 text-[0.65rem] hover:border-flare-300"
                onClick={() => {
                  setArchivedOnly(false);
                  setProviderFilters([]);
                  setSourceFilters([]);
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
          Projects
        </p>
        <div className="space-y-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-2xl border border-white/10 bg-ink-900/50 p-3"
            >
              <p className="text-sm text-ink-100">{project.name}</p>
              <p className="text-xs text-ink-400">{project.path}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-300">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 px-2 py-0.5"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                {project.lastThreadId ? (
                  <Link
                    to="/threads/$threadId"
                    params={{ threadId: project.lastThreadId }}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs hover:border-flare-300"
                  >
                    Latest Thread
                  </Link>
                ) : (
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-ink-400">
                    No threads yet
                  </span>
                )}
                <button className="rounded-full border border-white/10 px-3 py-1 text-xs hover:border-flare-300">
                  New Run
                </button>
              </div>
            </div>
          ))}
        </div>
        {hasMore ? (
          <div className="pt-2">
            <button
              className="w-full rounded-full border border-white/10 px-3 py-2 text-xs hover:border-flare-300"
              onClick={() => void loadMore()}
              disabled={isFetchingMore}
            >
              {isFetchingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
