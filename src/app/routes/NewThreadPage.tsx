import { useState } from "react";

import { ThreadComposer } from "@/app/components/threads/ThreadComposer";
import { ThreadEmptyState } from "@/app/components/threads/ThreadEmptyState";
import { ThreadModals } from "@/app/components/threads/ThreadModals";

export function NewThreadPage() {
  const [prefill, setPrefill] = useState("");
  const workspaceName = "photobooth";

  return (
    <div className="space-y-6">
      <ThreadEmptyState
        workspaceName={workspaceName}
        onSelectPrompt={setPrefill}
      />
      <div className="sticky bottom-4 z-10 space-y-3">
        <ThreadComposer prefillPrompt={prefill} workspaceName={workspaceName} />
      </div>
      <ThreadModals />
    </div>
  );
}
