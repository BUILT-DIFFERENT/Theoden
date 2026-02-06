import { useEffect, useMemo, useState } from "react";

import {
  getTerminalSession,
  subscribeTerminalSessions,
  type TerminalSession,
  type TerminalSessionScope,
} from "@/app/services/cli/terminalSessions";

export function useTerminalSession(scope: TerminalSessionScope) {
  const [version, setVersion] = useState(0);
  const scopeKey = `${scope.threadId ?? ""}::${scope.workspacePath ?? ""}`;

  useEffect(
    () =>
      subscribeTerminalSessions(() => {
        setVersion((current) => current + 1);
      }),
    [],
  );

  return useMemo<TerminalSession>(
    () => getTerminalSession(scope),
    [scopeKey, version],
  );
}
