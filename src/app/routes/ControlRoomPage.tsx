import { useThreadList } from "@/app/services/cli/useThreads";

export function ControlRoomPage() {
  const { projects, threads } = useThreadList();
  const activeRuns = projects.flatMap((project) => project.activeRuns);
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">Live Runs</p>
            <h2 className="font-display text-xl">Parallel agents in flight</h2>
          </div>
          <button className="rounded-full border border-white/10 px-4 py-2 text-xs hover:border-flare-300">
            New run
          </button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {activeRuns.length ? (
            activeRuns.map((run) => (
              <div key={run.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-ink-100">{run.title}</p>
                <p className="text-xs text-ink-400">{run.statusLabel}</p>
                <p className="mt-2 text-xs text-ink-300">Project: {run.projectId}</p>
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
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">Threads</p>
            <h2 className="font-display text-xl">Recent investigations</h2>
          </div>
          <button className="rounded-full border border-white/10 px-4 py-2 text-xs hover:border-flare-300">
            View all
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {threads.length ? (
            threads.map((thread) => (
              <div key={thread.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-ink-100">{thread.title}</p>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-ink-300">
                    {thread.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-400">{thread.subtitle}</p>
                <p className="mt-2 text-xs text-ink-300">Updated {thread.lastUpdated}</p>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-ink-400">
              No threads yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
