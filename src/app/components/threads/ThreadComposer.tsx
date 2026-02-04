export function ThreadComposer() {
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ink-300">New instruction</p>
          <p className="text-sm text-ink-200">Launch a new run or append to the thread</p>
        </div>
        <div className="flex gap-2 text-xs">
          <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">Local</button>
          <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">Worktree</button>
          <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">Cloud</button>
        </div>
      </div>
      <textarea
        className="mt-3 h-28 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-ink-100 focus:outline-none"
        placeholder="Describe the outcome you want: fix timestamp bug, add automation, generate PR..."
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">Attach image</button>
          <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">Choose skill</button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-ink-400">Effort</span>
          <select className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-ink-100">
            <option>Medium</option>
            <option>High</option>
            <option>Extra High</option>
          </select>
          <button className="rounded-full border border-flare-300 bg-flare-400/20 px-4 py-1 text-xs text-ink-50 shadow-glow">
            Start run
          </button>
        </div>
      </div>
    </div>
  );
}
