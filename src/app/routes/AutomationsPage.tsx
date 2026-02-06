export function AutomationsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
          Automations
        </p>
        <h2 className="font-display text-xl">Let&apos;s automate</h2>
        <p className="mt-2 text-sm text-ink-300">
          Schedule recurring runs, spawn new threads, and reuse prompt
          templates.
        </p>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
            Scheduler
          </p>
          <p className="mt-2 text-sm text-ink-300">
            Enable or disable recurring runs from here.
          </p>
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-ink-400">
            No scheduled automations yet.
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
            Templates
          </p>
          <p className="mt-2 text-sm text-ink-300">
            Create prompt templates with variables for reuse.
          </p>
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-ink-400">
            Template gallery coming soon.
          </div>
        </div>
      </section>
    </div>
  );
}
