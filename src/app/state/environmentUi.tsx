/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type EnvironmentMode = "local" | "worktree" | "cloud";

interface EnvironmentUiState {
  environmentMode: EnvironmentMode;
  setEnvironmentMode: (mode: EnvironmentMode) => void;
}

const EnvironmentUiContext = createContext<EnvironmentUiState | null>(null);

export function useEnvironmentUi() {
  const value = useContext(EnvironmentUiContext);
  if (!value) {
    throw new Error(
      "useEnvironmentUi must be used within EnvironmentUiContext",
    );
  }
  return value;
}

export function EnvironmentUiProvider({ children }: { children: ReactNode }) {
  const [environmentMode, setEnvironmentMode] =
    useState<EnvironmentMode>("local");

  const value = useMemo(
    () => ({
      environmentMode,
      setEnvironmentMode,
    }),
    [environmentMode],
  );

  return (
    <EnvironmentUiContext.Provider value={value}>
      {children}
    </EnvironmentUiContext.Provider>
  );
}
