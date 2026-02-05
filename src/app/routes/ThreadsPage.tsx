import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { unarchiveThread } from "@/app/services/cli/threads";
import { useThreadList } from "@/app/services/cli/useThreads";

export function ThreadsPage() {
  const [search, setSearch] = useState("");
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [providerFilters, setProviderFilters] = useState<string[]>([]);
  const [sourceFilters, setSourceFilters] = useState<string[]>([]);
  const {
    threads,
    providers,
    sources,
    hasMore,
    loadMore,
    isFetchingMore,
    isLoading,
  } = useThreadList({
    search,
    archived: archivedOnly ? true : undefined,
    modelProviders: providerFilters,
    sourceKinds: sourceFilters,
    limit: 40,
  });
  const queryClient = useQueryClient();
  const unarchive = useMutation({
    mutationFn: unarchiveThread,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["threads", "list"] });
    },
  });
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    if (!hasMore) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (isFetchingMore) return;
        void loadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isFetchingMore, loadMore]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Threads
            </p>
            <h2 className="font-display text-xl">All investigations</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search threads"
              className="w-56 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 focus:border-flare-300 focus:outline-none"
            />
            {search ? (
              <button
                className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
                onClick={() => setSearch("")}
              >
                Clear search
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div>
            <div className="space-y-3">
              {isLoading ? (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-ink-400">
                  Loading threads…
                </div>
              ) : threads.length ? (
                threads.map((thread) => {
                  const isUnarchiving =
                    unarchive.isPending && unarchive.variables === thread.id;
                  return (
                    <div
                      key={thread.id}
                      className="rounded-xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm text-ink-100">{thread.title}</p>
                          <p className="mt-1 text-xs text-ink-400">
                            {thread.subtitle}
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 px-2 py-1 text-[0.65rem] text-ink-300">
                          {thread.status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-300">
                        <span>Updated {thread.lastUpdated}</span>
                        {thread.modelProvider ? (
                          <span className="rounded-full border border-white/10 px-2 py-0.5">
                            {thread.modelProvider}
                          </span>
                        ) : null}
                        {thread.source ? (
                          <span className="rounded-full border border-white/10 px-2 py-0.5">
                            {thread.source}
                          </span>
                        ) : null}
                        {archivedOnly ? (
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-ink-400">
                            Archived
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                        <Link
                          to="/threads/$threadId"
                          params={{ threadId: thread.id }}
                          className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
                        >
                          Open in thread
                        </Link>
                        {archivedOnly ? (
                          <button
                            className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300 disabled:cursor-not-allowed disabled:border-white/5 disabled:text-ink-500"
                            onClick={() => unarchive.mutate(thread.id)}
                            disabled={isUnarchiving}
                          >
                            {isUnarchiving ? "Unarchiving…" : "Unarchive"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-ink-400">
                  {search
                    ? "No threads match your search."
                    : "No threads to display."}
                </div>
              )}
            </div>

            <div ref={loadMoreRef} className="h-8" />
            {hasMore ? (
              <button
                className="mt-2 rounded-full border border-white/10 px-4 py-2 text-xs hover:border-flare-300"
                onClick={() => void loadMore()}
                disabled={isFetchingMore}
              >
                {isFetchingMore ? "Loading…" : "Load more"}
              </button>
            ) : (
              <p className="mt-2 text-xs text-ink-500">
                {threads.length
                  ? "All threads loaded."
                  : "Create a run to start a new thread."}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-ink-900/70 p-4 shadow-card">
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
                        onClick={() =>
                          toggleFilter(provider, setProviderFilters)
                        }
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
        </div>
      </section>
    </div>
  );
}
