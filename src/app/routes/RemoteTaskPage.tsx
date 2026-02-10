import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";

import { readThread } from "@/app/services/cli/threads";
import { listHostCloudRuns } from "@/app/services/host/cloudRuns";
import { isTauri } from "@/app/utils/tauri";

export function RemoteTaskPage() {
  const navigate = useNavigate();
  const { taskId } = useParams({ from: "/remote/$taskId" });
  const desktop = isTauri();
  const threadQuery = useQuery({
    queryKey: ["threads", "read", "remote-alias", taskId],
    queryFn: () => readThread(taskId, false),
    retry: false,
    enabled: desktop,
  });
  const runQuery = useQuery({
    queryKey: ["cloud", "runs", "remote-task", taskId],
    queryFn: async () => {
      const runs = await listHostCloudRuns();
      return (
        runs.find((run) => run.taskId === taskId || run.runId === taskId) ??
        null
      );
    },
    enabled: desktop,
    retry: false,
  });

  useEffect(() => {
    const threadId = threadQuery.data?.id;
    if (!threadId) {
      return;
    }
    void navigate({
      to: "/t/$threadId",
      params: { threadId },
      replace: true,
    });
  }, [navigate, threadQuery.data?.id]);

  if (threadQuery.isPending || runQuery.isPending) {
    return (
      <section className="surface-panel animate-toast-open p-4 text-sm text-ink-300">
        Resolving remote task…
      </section>
    );
  }

  return (
    <section className="surface-panel max-w-2xl p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
        Remote task
      </p>
      <h1 className="mt-2 font-display text-2xl text-ink-50">Task mapping</h1>
      <p className="mt-2 text-sm text-ink-300">
        Task id <span className="font-mono">{taskId}</span>{" "}
        {runQuery.data
          ? "is available in the current cloud run store."
          : "is not currently linked to a local thread."}
      </p>
      {runQuery.data ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-ink-300">
          <p>Run id: {runQuery.data.runId}</p>
          <p>Status: {runQuery.data.status}</p>
          <p>Thread id: {runQuery.data.threadId}</p>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link
          to="/inbox"
          className="rounded-full border border-white/10 px-4 py-2 text-ink-100 hover:border-flare-300"
        >
          Open inbox
        </Link>
        <Link
          to="/automations"
          className="rounded-full border border-white/10 px-4 py-2 text-ink-100 hover:border-flare-300"
        >
          Open automations
        </Link>
      </div>
    </section>
  );
}
