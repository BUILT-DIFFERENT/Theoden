import { useAppServerHealth } from "@/app/state/appServerHealth";
import { isTauri } from "@/app/utils/tauri";

import type { ReactNode } from "react";

interface AppServerRouteBoundaryProps {
  children: ReactNode;
}

export function AppServerRouteBoundary({
  children,
}: AppServerRouteBoundaryProps) {
  const { status, lastError, restart } = useAppServerHealth();

  if (!isTauri()) {
    return <>{children}</>;
  }

  if (status === "booting" || status === "reconnecting") {
    return (
      <div className="surface-panel mx-auto max-w-2xl px-5 py-6 text-sm text-ink-200">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
          App-server
        </p>
        <h2 className="mt-2 font-display text-lg text-ink-50">
          {status === "booting"
            ? "Starting local app-server…"
            : "Reconnecting to local app-server…"}
        </h2>
        <p className="mt-2 text-xs text-ink-400">
          Routes are paused until the RPC transport is healthy.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="surface-panel mx-auto max-w-2xl px-5 py-6 text-sm text-ink-200">
        <p className="text-xs uppercase tracking-[0.2em] text-rose-300">
          App-server unavailable
        </p>
        <p className="mt-2 text-xs text-ink-400">
          {lastError ?? "Connection to app-server failed."}
        </p>
        <button
          className="mt-4 rounded-full border border-flare-300 bg-flare-400/10 px-4 py-1.5 text-xs text-ink-50 hover:bg-flare-400/20"
          onClick={restart}
        >
          Retry connection
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
