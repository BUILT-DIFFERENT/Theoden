import { mockThreadDetail } from "@/app/state/mockData";

export function DiffPanel() {
  const summary = mockThreadDetail.diffSummary;
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ink-300">Changes</p>
          <p className="text-sm text-ink-200">
            {summary.filesChanged} files · +{summary.additions} / -{summary.deletions}
          </p>
        </div>
        <button className="rounded-full border border-white/10 px-3 py-1 text-xs hover:border-flare-300">
          Open diff viewer
        </button>
      </div>
      <div className="mt-4 space-y-3 text-sm">
        {summary.files.map((file) => (
          <div key={file.path} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <span className="text-ink-100">{file.path}</span>
            <span className="text-xs text-ink-400">
              +{file.additions} / -{file.deletions}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">Stage all</button>
        <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">Commit</button>
        <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">Commit &amp; PR</button>
      </div>
    </div>
  );
}
