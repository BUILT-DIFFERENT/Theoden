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

  const showBanner = status === "booting" || status === "reconnecting";
  const showError = status === "error";
  const bannerLabel =
    status === "booting"
      ? "Starting local app-server…"
      : "Reconnecting to local app-server…";

  return (
    <div className="flex flex-col gap-4">
      {showBanner ? (
        <div
          className="surface-panel px-4 py-3 text-xs text-ink-200"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-ink-500">
                App-server
              </p>
              <p className="mt-1 text-sm text-ink-50">{bannerLabel}</p>
            </div>
            <p className="text-xs text-ink-400">
              You can keep working while we reconnect.
            </p>
          </div>
        </div>
      ) : null}
      {showError ? (
        <div
          className="surface-panel px-4 py-3 text-xs text-ink-200"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-rose-300">
                App-server unavailable
              </p>
              <p className="mt-1 text-xs text-ink-400">
                {lastError ?? "Connection to app-server failed."}
              </p>
            </div>
            <button
              className="rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-[11px] text-ink-50 hover:bg-flare-400/20"
              onClick={restart}
            >
              Retry connection
            </button>
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}
