import { mockInstalledSkills, mockRemoteSkills } from "@/app/state/skillsData";

export function SkillsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Installed
            </p>
            <h2 className="font-display text-xl">Skills in your workspace</h2>
          </div>
          <button className="rounded-full border border-white/10 px-4 py-2 text-xs hover:border-flare-300">
            Reload
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {mockInstalledSkills.map((skill) => (
            <div
              key={skill.id}
              className="rounded-xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink-100">{skill.name}</p>
                <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-ink-300">
                  Installed
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-400">{skill.description}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-300">
                {skill.permissions.map((perm) => (
                  <span
                    key={perm}
                    className="rounded-full border border-white/10 px-2 py-0.5"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Downloadable
            </p>
            <h2 className="font-display text-xl">Remote skills catalog</h2>
          </div>
          <button className="rounded-full border border-white/10 px-4 py-2 text-xs hover:border-flare-300">
            Browse all
          </button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {mockRemoteSkills.map((skill) => (
            <div
              key={skill.id}
              className="rounded-xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink-100">{skill.name}</p>
                <span className="text-xs text-ink-400">{skill.publisher}</span>
              </div>
              <p className="mt-1 text-xs text-ink-400">{skill.description}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-300">
                {skill.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 px-2 py-0.5"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">
                  View details
                </button>
                <button className="rounded-full border border-flare-300 bg-flare-400/20 px-3 py-1 text-ink-50 shadow-glow">
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
