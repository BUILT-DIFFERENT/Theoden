/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from "react";

export type ThreadModal = "worktree" | "branch" | "commit" | "pr" | null;

export interface ThreadUiState {
  reviewOpen: boolean;
  setReviewOpen: (open: boolean) => void;
  activeModal: ThreadModal;
  setActiveModal: (modal: ThreadModal) => void;
}

const ThreadUiContext = createContext<ThreadUiState | null>(null);

export function useThreadUi() {
  const value = useContext(ThreadUiContext);
  if (!value) {
    throw new Error("useThreadUi must be used within ThreadUiContext");
  }
  return value;
}

export const ThreadUiProvider = ThreadUiContext.Provider;
