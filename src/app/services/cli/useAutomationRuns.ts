import { useEffect, useMemo, useState } from "react";

import {
  getAutomationRuns,
  subscribeAutomationRuns,
  type AutomationRunRecord,
} from "@/app/services/cli/automationRuns";

export function useAutomationRuns(automationId?: string | null) {
  const [runs, setRuns] = useState<AutomationRunRecord[]>(() =>
    getAutomationRuns(automationId),
  );

  useEffect(() => {
    setRuns(getAutomationRuns(automationId));
    return subscribeAutomationRuns(() => {
      setRuns(getAutomationRuns(automationId));
    });
  }, [automationId]);

  return useMemo(() => runs, [runs]);
}
