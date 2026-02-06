import { useEffect } from "react";

import { ThreadComposer } from "@/app/components/threads/ThreadComposer";
import { ThreadEmptyState } from "@/app/components/threads/ThreadEmptyState";
import { ThreadModals } from "@/app/components/threads/ThreadModals";
import { useAppUi } from "@/app/state/appUi";
import { useThreadUi } from "@/app/state/threadUi";

export function NewThreadPage() {
  const { setComposerDraft } = useAppUi();
  const { setActiveModal } = useThreadUi();

  useEffect(() => {
    setComposerDraft("");
    setActiveModal(null);
  }, [setActiveModal, setComposerDraft]);

  return (
    <div className="flex min-h-[70vh] flex-col justify-between gap-10">
      <ThreadEmptyState />
      <div className="sticky bottom-4 z-10 space-y-3">
        <ThreadComposer />
      </div>
      <ThreadModals />
    </div>
  );
}
