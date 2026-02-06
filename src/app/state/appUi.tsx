/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type QualityPreset = "low" | "medium" | "high" | "extra_high";

interface AppUiState {
  activeModel: string;
  setActiveModel: (model: string) => void;
  qualityPreset: QualityPreset;
  setQualityPreset: (preset: QualityPreset) => void;
  composerDraft: string;
  setComposerDraft: (draft: string) => void;
  isTerminalOpen: boolean;
  setIsTerminalOpen: (open: boolean) => void;
  toggleTerminal: () => void;
}

const AppUiContext = createContext<AppUiState | null>(null);

export function useAppUi() {
  const value = useContext(AppUiContext);
  if (!value) {
    throw new Error("useAppUi must be used within AppUiProvider");
  }
  return value;
}

export function AppUiProvider({ children }: { children: ReactNode }) {
  const [activeModel, setActiveModel] = useState("GPT-5.2-Codex");
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>("high");
  const [composerDraft, setComposerDraft] = useState("");
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  const toggleTerminal = useCallback(() => {
    setIsTerminalOpen((open) => !open);
  }, []);

  const value = useMemo(
    () => ({
      activeModel,
      setActiveModel,
      qualityPreset,
      setQualityPreset,
      composerDraft,
      setComposerDraft,
      isTerminalOpen,
      setIsTerminalOpen,
      toggleTerminal,
    }),
    [activeModel, qualityPreset, composerDraft, isTerminalOpen, toggleTerminal],
  );

  return (
    <AppUiContext.Provider value={value}>{children}</AppUiContext.Provider>
  );
}
