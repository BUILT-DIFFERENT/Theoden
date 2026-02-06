/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from "react";

export type AppServerHealthStatus =
  | "booting"
  | "ready"
  | "reconnecting"
  | "error";

export interface AppServerHealthState {
  status: AppServerHealthStatus;
  lastError: string | null;
  reconnectAttempts: number;
  restart: () => void;
}

const AppServerHealthContext = createContext<AppServerHealthState | null>(null);

export function useAppServerHealth() {
  const value = useContext(AppServerHealthContext);
  if (!value) {
    throw new Error(
      "useAppServerHealth must be used within AppServerHealthProvider",
    );
  }
  return value;
}

export const AppServerHealthProvider = AppServerHealthContext.Provider;
