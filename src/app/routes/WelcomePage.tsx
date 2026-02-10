import { Link } from "@tanstack/react-router";

export function WelcomePage() {
  return (
    <section className="surface-panel max-w-3xl p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-ink-300">Welcome</p>
      <h1 className="mt-2 font-display text-3xl text-ink-50">
        Codex Desktop for Tauri
      </h1>
      <p className="mt-3 text-sm text-ink-300">
        Start a thread, review code changes, and manage automations in one
        workspace-aware UI.
      </p>
      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        <Link
          to="/"
          className="rounded-full border border-white/10 px-4 py-2 text-ink-100 hover:border-flare-300"
        >
          New thread
        </Link>
        <Link
          to="/select-workspace"
          className="rounded-full border border-white/10 px-4 py-2 text-ink-100 hover:border-flare-300"
        >
          Select workspace
        </Link>
        <Link
          to="/automations"
          className="rounded-full border border-white/10 px-4 py-2 text-ink-100 hover:border-flare-300"
        >
          Automations
        </Link>
      </div>
    </section>
  );
}
