/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  loadSelectedWorkspace,
  storeSelectedWorkspace,
} from "@/app/state/workspaces";

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
  const [selectedWorkspace, setSelectedWorkspaceState] = useState<
    string | null
  >(() => loadSelectedWorkspace());
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);

  useEffect(() => {
    storeSelectedWorkspace(selectedWorkspace);
  }, [selectedWorkspace]);

  const setSelectedWorkspace = (path: string | null) => {
    setSelectedWorkspaceState(path);
  };

  const value = useMemo(
    () => ({
      selectedWorkspace,
      setSelectedWorkspace,
      workspacePickerOpen,
      setWorkspacePickerOpen,
    }),
    [selectedWorkspace, workspacePickerOpen],
  );

  return (
    <WorkspaceUiContext.Provider value={value}>
      {children}
    </WorkspaceUiContext.Provider>
  );
}
