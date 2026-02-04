import { Link } from "@tanstack/react-router";
import { mockProjects } from "@/app/state/mockData";

export function ControlRoomSidebar() {
  return (
    <aside className="w-72 border-r border-white/5 bg-ink-900/60 px-4 py-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">Codex</p>
        <h2 className="font-display text-lg">Situation Room</h2>
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-ink-900/70 p-4 shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">Active</p>
        <div className="mt-3 space-y-3 text-sm">
          {mockProjects.flatMap((project) => project.activeRuns).map((run) => (
            <div key={run.id} className="rounded-xl border border-white/5 bg-black/20 p-3">
              <p className="text-ink-100">{run.title}</p>
              <p className="text-xs text-ink-400">{run.statusLabel}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">Projects</p>
        <div className="space-y-3">
          {mockProjects.map((project) => (
            <div key={project.id} className="rounded-2xl border border-white/10 bg-ink-900/50 p-3">
              <p className="text-sm text-ink-100">{project.name}</p>
              <p className="text-xs text-ink-400">{project.path}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-300">
                {project.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-white/10 px-2 py-0.5">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Link
                  to="/threads/$threadId"
                  params={{ threadId: project.lastThreadId }}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs hover:border-flare-300"
                >
                  Latest Thread
                </Link>
                <button className="rounded-full border border-white/10 px-3 py-1 text-xs hover:border-flare-300">
                  New Run
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
