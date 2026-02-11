import { useMemo } from "react";

import { useRuntimeSettings } from "@/app/state/useRuntimeSettings";

function resolveQueryValue(key: string) {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const value = params.get(key);
  return value?.trim().length ? value : null;
}

export function FilePreviewPage() {
  const runtimeSettings = useRuntimeSettings();
  const path = resolveQueryValue("path");
  const line = resolveQueryValue("line");
  const metadata = useMemo(
    () => ({
      editor: runtimeSettings.openDestination,
      followUp: runtimeSettings.followUpBehavior,
    }),
    [runtimeSettings.followUpBehavior, runtimeSettings.openDestination],
  );

  return (
    <div className="space-y-4">
      <section className="surface-panel p-5">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-400">
          File preview
        </p>
        <h1 className="mt-2 font-display text-2xl text-ink-50">
          File preview contract route
        </h1>
        <p className="mt-2 text-sm text-ink-300">
          This route preserves desktop deeplink compatibility for targeted file
          navigation and editor open actions.
        </p>
      </section>
      <section className="surface-panel p-4 text-sm text-ink-200">
        <div className="space-y-2">
          <p>
            <span className="text-ink-400">Path:</span>{" "}
            <span className="font-mono text-xs">
              {path ?? "(not provided)"}
            </span>
          </p>
          <p>
            <span className="text-ink-400">Line:</span>{" "}
            <span className="font-mono text-xs">{line ?? "(default)"}</span>
          </p>
          <p>
            <span className="text-ink-400">Preferred editor:</span>{" "}
            <span className="text-xs">{metadata.editor}</span>
          </p>
          <p>
            <span className="text-ink-400">Follow-up mode:</span>{" "}
            <span className="text-xs">{metadata.followUp}</span>
          </p>
        </div>
      </section>
    </div>
  );
}
