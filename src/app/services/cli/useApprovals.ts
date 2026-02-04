import { useEffect, useState } from "react";
import { getApprovals, subscribeApprovals } from "@/app/services/cli/approvals";
import type { ApprovalRequest } from "@/app/services/cli/approvals";

export function useApprovals(threadId?: string) {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(getApprovals(threadId));

  useEffect(() => {
    return subscribeApprovals(() => {
      setApprovals(getApprovals(threadId));
    });
  }, [threadId]);

  return approvals;
}
