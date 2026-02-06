import { useState } from "react";

import { ThreadComposer } from "@/app/components/threads/ThreadComposer";
import { ThreadEmptyState } from "@/app/components/threads/ThreadEmptyState";
import { ThreadModals } from "@/app/components/threads/ThreadModals";

export function NewThreadPage() {
  const [prefill, setPrefill] = useState("");

  return (
    <div className="flex min-h-[70vh] flex-col justify-between gap-10">
      <ThreadEmptyState onSelectPrompt={setPrefill} />
      <div className="sticky bottom-4 z-10 space-y-3">
        <ThreadComposer prefillPrompt={prefill} />
      </div>
      <ThreadModals />
    </div>
  );
}
