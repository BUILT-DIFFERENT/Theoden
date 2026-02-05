import { useEffect, useState } from "react";

import {
  getApprovals,
  subscribeApprovals,
  type ApprovalRequest,
} from "@/app/services/cli/approvals";

export function useApprovals(threadId?: string) {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(
    getApprovals(threadId),
  );

  useEffect(() => {
    setApprovals(getApprovals(threadId));
    return subscribeApprovals(() => {
      setApprovals(getApprovals(threadId));
    });
  }, [getApprovals, subscribeApprovals, threadId]);

  return approvals;
}
