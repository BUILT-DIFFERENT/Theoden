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
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);

  useEffect(() => {
    if (selectedWorkspace || !workspaces.length) {
      return;
    }
    setSelectedWorkspaceState(workspaces[0].path);
  }, [selectedWorkspace, workspaces]);

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
    if (!matchingWorkspace || matchingWorkspace.path === selectedWorkspace) {
      return;
    }
    setSelectedWorkspaceState(matchingWorkspace.path);
  }, [selectedWorkspace, workspaces]);

  useEffect(() => {
    storeSelectedWorkspace(selectedWorkspace);
  }, [selectedWorkspace]);

  const setSelectedWorkspace = useCallback((path: string | null) => {
    if (!path) {
      setSelectedWorkspaceState(null);
      return;
    }
    setSelectedWorkspaceState(normalizeWorkspacePath(path));
  }, []);

  const value = useMemo(
    () => ({
      selectedWorkspace,
      setSelectedWorkspace,
      workspacePickerOpen,
      setWorkspacePickerOpen,
    }),
    [selectedWorkspace, setSelectedWorkspace, workspacePickerOpen],
  );

  return (
    <WorkspaceUiContext.Provider value={value}>
      {children}
    </WorkspaceUiContext.Provider>
  );
}
