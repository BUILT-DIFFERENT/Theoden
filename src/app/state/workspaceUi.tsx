/* eslint-disable react-refresh/only-export-components */
import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import {
  loadSelectedWorkspace,
  storeSelectedWorkspace,
} from "@/app/state/workspaces";
import { normalizeWorkspacePath } from "@/app/utils/workspace";

export interface WorkspaceUiState {
  selectedWorkspace: string | null;
  setSelectedWorkspace: (path: string | null) => void;
  unavailableWorkspace: string | null;
  dismissUnavailableWorkspace: () => void;
  workspacePickerOpen: boolean;
  setWorkspacePickerOpen: (open: boolean) => void;
}

const WorkspaceUiContext = createContext<WorkspaceUiState | null>(null);

export function useWorkspaceUi() {
  const value = useContext(WorkspaceUiContext);
  if (!value) {
    throw new Error("useWorkspaceUi must be used within WorkspaceUiContext");
  }
  return value;
}

export function WorkspaceUiProvider({ children }: { children: ReactNode }) {
  const { workspaces } = useWorkspaces();
  const [selectedWorkspace, setSelectedWorkspaceState] = useState<
    string | null
  >(() => loadSelectedWorkspace());
  const [unavailableWorkspace, setUnavailableWorkspace] = useState<
    string | null
  >(null);
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);

  useEffect(() => {
    if (selectedWorkspace || !workspaces.length || unavailableWorkspace) {
      return;
    }
    setSelectedWorkspaceState(workspaces[0].path);
  }, [selectedWorkspace, unavailableWorkspace, workspaces]);

  useEffect(() => {
    if (!selectedWorkspace) {
      return;
    }
    const selectedWorkspaceKey =
      normalizeWorkspacePath(selectedWorkspace).toLowerCase();
    const matchingWorkspace = workspaces.find(
      (workspace) =>
        normalizeWorkspacePath(workspace.path).toLowerCase() ===
        selectedWorkspaceKey,
    );
    if (!matchingWorkspace) {
      setUnavailableWorkspace(selectedWorkspace);
      if (workspaces.length) {
        setSelectedWorkspaceState(workspaces[0].path);
      } else {
        setSelectedWorkspaceState(null);
      }
      setWorkspacePickerOpen(true);
      return;
    }
    if (matchingWorkspace.path !== selectedWorkspace) {
      setSelectedWorkspaceState(matchingWorkspace.path);
    }
    if (unavailableWorkspace === selectedWorkspace) {
      setUnavailableWorkspace(null);
    }
  }, [selectedWorkspace, unavailableWorkspace, workspaces]);

  useEffect(() => {
    if (!unavailableWorkspace) {
      return;
    }
    const unavailableKey = normalizeWorkspacePath(unavailableWorkspace)
      .toLowerCase()
      .trim();
    const hasRecoveredWorkspace = workspaces.some(
      (workspace) =>
        normalizeWorkspacePath(workspace.path).toLowerCase() === unavailableKey,
    );
    if (hasRecoveredWorkspace) {
      setUnavailableWorkspace(null);
    }
  }, [unavailableWorkspace, workspaces]);

  useEffect(() => {
    storeSelectedWorkspace(selectedWorkspace);
  }, [selectedWorkspace]);

  const setSelectedWorkspace = useCallback((path: string | null) => {
    setUnavailableWorkspace(null);
    if (!path) {
      setSelectedWorkspaceState(null);
      return;
    }
    setSelectedWorkspaceState(normalizeWorkspacePath(path));
  }, []);

  const dismissUnavailableWorkspace = useCallback(() => {
    setUnavailableWorkspace(null);
  }, []);

  const value = useMemo(
    () => ({
      selectedWorkspace,
      setSelectedWorkspace,
      unavailableWorkspace,
      dismissUnavailableWorkspace,
      workspacePickerOpen,
      setWorkspacePickerOpen,
    }),
    [
      dismissUnavailableWorkspace,
      selectedWorkspace,
      setSelectedWorkspace,
      unavailableWorkspace,
      workspacePickerOpen,
    ],
  );

  return (
    <WorkspaceUiContext.Provider value={value}>
      {children}
    </WorkspaceUiContext.Provider>
  );
}
