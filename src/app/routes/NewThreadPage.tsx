import { useEffect, useMemo, useState } from "react";

import { ThreadComposer } from "@/app/components/threads/ThreadComposer";
import { ThreadEmptyState } from "@/app/components/threads/ThreadEmptyState";
import { ThreadModals } from "@/app/components/threads/ThreadModals";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { useAppUi } from "@/app/state/appUi";
import { useThreadUi } from "@/app/state/threadUi";
import { useWorkspaceUi } from "@/app/state/workspaceUi";

const SKIP_NO_WORKSPACE_KEY = "codex.onboarding.skipNoWorkspace";

function loadSkipNoWorkspaceOnboarding() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(SKIP_NO_WORKSPACE_KEY) === "1";
}

function storeSkipNoWorkspaceOnboarding(skip: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  if (skip) {
    window.localStorage.setItem(SKIP_NO_WORKSPACE_KEY, "1");
    return;
  }
  window.localStorage.removeItem(SKIP_NO_WORKSPACE_KEY);
}

export function NewThreadPage() {
  const [prefill, setPrefill] = useState("");
  const [skipNoWorkspaceOnboarding, setSkipNoWorkspaceOnboarding] = useState(
    () => loadSkipNoWorkspaceOnboarding(),
  );
  const { workspaces } = useWorkspaces();
  const { setComposerDraft } = useAppUi();
  const { setActiveModal } = useThreadUi();
  const { setWorkspacePickerOpen } = useWorkspaceUi();

  useEffect(() => {
    setPrefill("");
    setComposerDraft("");
    setActiveModal(null);
  }, [setActiveModal, setComposerDraft]);

  const showWorkspaceOnboarding = useMemo(() => {
    return workspaces.length === 0 && !skipNoWorkspaceOnboarding;
  }, [skipNoWorkspaceOnboarding, workspaces.length]);

  return (
    <div className="flex min-h-[70vh] flex-col justify-between gap-10">
      {showWorkspaceOnboarding ? (
        <section className="mx-auto w-full max-w-3xl rounded-2xl border border-white/10 bg-black/20 p-6 text-center shadow-card">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-400">
            Workspace setup
          </p>
          <h2 className="mt-2 font-display text-3xl text-ink-50">
            Add a project to get started
          </h2>
          <p className="mt-3 text-sm text-ink-300">
            Connect a workspace first so threads, diffs, and git actions are
            scoped to real project files.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs">
            <button
              className="rounded-full border border-flare-300 bg-flare-400/10 px-4 py-1.5 text-ink-50 hover:bg-flare-400/20"
              onClick={() => setWorkspacePickerOpen(true)}
            >
              Add project
            </button>
            <button
              className="rounded-full border border-white/10 px-4 py-1.5 text-ink-300 hover:border-flare-300 hover:text-ink-100"
              onClick={() => {
                setSkipNoWorkspaceOnboarding(true);
                storeSkipNoWorkspaceOnboarding(true);
              }}
            >
              Skip
            </button>
          </div>
        </section>
      ) : (
        <ThreadEmptyState onSelectPrompt={setPrefill} />
      )}
      <div className="sticky bottom-4 z-10 space-y-3">
        <ThreadComposer prefillPrompt={prefill} />
      </div>
      <ThreadModals />
    </div>
  );
}
