import { useNavigate } from "@tanstack/react-router";

import { DiffPanel } from "@/app/components/diff/DiffPanel";
import { useThreadDetail } from "@/app/services/cli/useThreadDetail";

function threadIdFromLocation() {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const value = params.get("threadId");
  return value?.trim().length ? value : null;
}

export function DiffRoutePage() {
  const navigate = useNavigate();
  const explicitThreadId = threadIdFromLocation();
  const { thread } = useThreadDetail(explicitThreadId ?? undefined);

  return (
    <div className="space-y-4">
      <section className="surface-panel p-4">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-400">Diff</p>
        <h1 className="mt-2 font-display text-2xl text-ink-50">
          Full diff workspace
        </h1>
        <p className="mt-2 text-sm text-ink-300">
          Open this route directly via deeplink or from thread actions to review
          and stage changes.
        </p>
        {explicitThreadId ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-white/10 px-2 py-1 text-ink-300">
              threadId: {explicitThreadId}
            </span>
            <button
              className="btn-flat"
              onClick={() => {
                void navigate({
                  to: "/t/$threadId",
                  params: { threadId: explicitThreadId },
                });
              }}
            >
              Open thread
            </button>
          </div>
        ) : null}
      </section>
      <DiffPanel thread={thread} />
    </div>
  );
}
