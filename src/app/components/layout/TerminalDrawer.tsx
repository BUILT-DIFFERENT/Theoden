import { Terminal } from "lucide-react";

interface TerminalDrawerProps {
  isOpen: boolean;
}

export function TerminalDrawer({ isOpen }: TerminalDrawerProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <section className="border-t border-white/10 bg-black/50 px-6 py-4 backdrop-blur-xl">
      <div className="rounded-2xl border border-white/10 bg-ink-900/70 shadow-card">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-xs text-ink-300">
          <Terminal className="h-3.5 w-3.5" />
          Terminal
          <span className="text-[0.65rem] text-ink-500">Workspace shell</span>
        </div>
        <div className="max-h-40 space-y-1 overflow-auto px-4 py-3 font-mono text-[0.7rem] text-ink-300">
          <p className="text-ink-500">$ codex status</p>
          <p>Workspace ready.</p>
          <p className="text-ink-500">$ git status --short</p>
          <p>Working tree clean.</p>
        </div>
        <div className="border-t border-white/10 px-4 py-3">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-[0.75rem] text-ink-300">
            <span className="text-ink-500">$</span>
            <input
              className="w-full bg-transparent text-ink-100 placeholder:text-ink-500 focus:outline-none"
              placeholder="Type a command (stub)"
            />
          </label>
        </div>
      </div>
    </section>
  );
}
