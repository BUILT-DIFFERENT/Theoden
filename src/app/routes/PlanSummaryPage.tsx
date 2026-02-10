import { useQuery } from "@tanstack/react-query";

import { listApps } from "@/app/services/cli/apps";
import { listCollaborationModes } from "@/app/services/cli/models";
import { listLoadedThreads } from "@/app/services/cli/threads";

import type { ReactNode } from "react";

function ParityQueryBlock(props: {
  title: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: ReactNode;
}) {
  return (
    <section className="surface-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm text-ink-100">{props.title}</h2>
        <button className="btn-flat" onClick={props.onRetry}>
          Retry
        </button>
      </div>
      {props.loading ? (
        <p className="mt-3 text-xs text-ink-400">Loading…</p>
      ) : props.error ? (
        <p className="mt-3 text-xs text-rose-300">{props.error}</p>
      ) : (
        <div className="mt-3">{props.children}</div>
      )}
    </section>
  );
}

export function PlanSummaryPage() {
  const loadedThreads = useQuery({
    queryKey: ["threads", "loaded", "plan-summary"],
    queryFn: () => listLoadedThreads({ limit: 50 }),
    refetchOnWindowFocus: true,
  });
  const apps = useQuery({
    queryKey: ["apps", "list", "plan-summary"],
    queryFn: () => listApps({ limit: 25 }),
    refetchOnWindowFocus: true,
  });
  const collaborationModes = useQuery({
    queryKey: ["collaboration-modes", "list", "plan-summary"],
    queryFn: () => listCollaborationModes({ limit: 25 }),
    refetchOnWindowFocus: true,
  });

  return (
    <div className="space-y-4">
      <section className="surface-panel p-5">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-400">
          Plan summary
        </p>
        <h1 className="mt-2 font-display text-2xl text-ink-50">
          Runtime planning overview
        </h1>
        <p className="mt-2 text-sm text-ink-300">
          This page activates deferred app-server parity surfaces and reports
          their live availability in production UI.
        </p>
      </section>

      <ParityQueryBlock
        title="Loaded threads"
        loading={loadedThreads.isPending}
        error={
          loadedThreads.error instanceof Error
            ? loadedThreads.error.message
            : null
        }
        onRetry={() => {
          void loadedThreads.refetch();
        }}
      >
        <p className="text-xs text-ink-300">
          {loadedThreads.data?.data.length ?? 0} loaded thread id
          {(loadedThreads.data?.data.length ?? 0) === 1 ? "" : "s"}.
        </p>
      </ParityQueryBlock>

      <ParityQueryBlock
        title="Available apps"
        loading={apps.isPending}
        error={apps.error instanceof Error ? apps.error.message : null}
        onRetry={() => {
          void apps.refetch();
        }}
      >
        <div className="space-y-2 text-xs text-ink-300">
          {(apps.data?.data ?? []).length ? (
            apps.data?.data.map((app) => (
              <div
                key={app.id}
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"
              >
                <p className="text-ink-100">{app.name}</p>
                <p className="text-ink-400">{app.description ?? app.id}</p>
              </div>
            ))
          ) : (
            <p>No apps reported by app-server.</p>
          )}
        </div>
      </ParityQueryBlock>

      <ParityQueryBlock
        title="Collaboration modes"
        loading={collaborationModes.isPending}
        error={
          collaborationModes.error instanceof Error
            ? collaborationModes.error.message
            : null
        }
        onRetry={() => {
          void collaborationModes.refetch();
        }}
      >
        <div className="space-y-2 text-xs text-ink-300">
          {(collaborationModes.data?.data ?? []).length ? (
            collaborationModes.data?.data.map((mode, index) => (
              <pre
                key={`collab-mode-${index}`}
                className="overflow-auto rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[0.68rem] text-ink-300"
              >
                {JSON.stringify(mode, null, 2)}
              </pre>
            ))
          ) : (
            <p>No collaboration modes reported by app-server.</p>
          )}
        </div>
      </ParityQueryBlock>
    </div>
  );
}
