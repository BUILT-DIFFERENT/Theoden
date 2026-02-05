import { useEffect, useState } from "react";

import { getDiffText, subscribeDiffs } from "@/app/services/cli/diffUpdates";

export function useThreadDiffText(threadId?: string, fallback?: string) {
  const [diffText, setDiffText] = useState(
    getDiffText(threadId) ?? fallback ?? "",
  );

  useEffect(() => {
    setDiffText(getDiffText(threadId) ?? fallback ?? "");
    return subscribeDiffs(() => {
      setDiffText(getDiffText(threadId) ?? fallback ?? "");
    });
  }, [fallback, threadId]);

  return diffText;
}
