import { mockProviders, mockEditors } from "@/app/state/settingsData";

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">Config</p>
        <h2 className="font-display text-xl">Unified CLI configuration</h2>
        <p className="mt-2 text-sm text-ink-300">
          Shows the merged user config and per-project overrides from the Codex CLI config TOML.
        </p>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-ink-300">
          config.toml preview will live here.
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">
            Open config file
          </button>
          <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">
            Validate TOML
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">Editors</p>
        <h2 className="font-display text-xl">Detected tools</h2>
        <div className="mt-4 space-y-2 text-sm">
          {mockEditors.map((editor) => (
            <div key={editor.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <span>{editor.name}</span>
              <span className="text-xs text-ink-400">
                {editor.detected ? "Detected" : "Not found"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">Providers</p>
        <h2 className="font-display text-xl">Execution backends</h2>
        <div className="mt-4 space-y-2 text-sm">
          {mockProviders.map((provider) => (
            <div key={provider.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <span>{provider.id}</span>
              <span className="text-xs text-ink-400">{provider.detail}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
