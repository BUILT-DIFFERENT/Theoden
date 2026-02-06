import {
  ChevronDown,
  Cloud,
  Code2,
  FileCode2,
  ListChecks,
  Search,
  ShieldAlert,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

import { WorkspacePickerDropdown } from "@/app/components/workspaces/WorkspacePickerDropdown";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import { workspaceNameFromPath } from "@/app/utils/workspace";

interface ThreadEmptyStateProps {
  onSelectPrompt: (prompt: string) => void;
}

type PromptCategory = "Get started" | "Skills" | "Automations";

interface PromptTemplate {
  id: string;
  label: string;
  Icon: typeof Cloud;
  category: PromptCategory;
}

const promptCatalog: PromptTemplate[] = [
  {
    id: "game",
    label: "Create a classic snake game",
    Icon: FileCode2,
    category: "Get started",
  },
  {
    id: "bugfix",
    label: "Find and fix bugs in my code",
    Icon: ShieldAlert,
    category: "Get started",
  },
  {
    id: "summary",
    label: "Summarize this app in a PDF",
    Icon: ListChecks,
    category: "Get started",
  },
  {
    id: "refactor",
    label: "Refactor this module for readability",
    Icon: Code2,
    category: "Skills",
  },
  {
    id: "audit",
    label: "Scan for security and dependency risks",
    Icon: Search,
    category: "Skills",
  },
  {
    id: "docs",
    label: "Write docs for the modified API surface",
    Icon: WandSparkles,
    category: "Skills",
  },
  {
    id: "release",
    label: "Draft release notes from recent commits",
    Icon: Sparkles,
    category: "Automations",
  },
  {
    id: "daily",
    label: "Create a daily status summary workflow",
    Icon: ListChecks,
    category: "Automations",
  },
  {
    id: "triage",
    label: "Generate recurring bug triage tasks",
    Icon: ShieldAlert,
    category: "Automations",
  },
];

const categories: PromptCategory[] = ["Get started", "Skills", "Automations"];

export function ThreadEmptyState({ onSelectPrompt }: ThreadEmptyStateProps) {
  const { workspaces } = useWorkspaces();
  const { selectedWorkspace } = useWorkspaceUi();
  const [selectedCategory, setSelectedCategory] =
    useState<PromptCategory>("Get started");
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const resolvedWorkspace =
    selectedWorkspace ?? workspaces[0]?.path ?? "Add workspace";
  const label = resolvedWorkspace
    ? workspaceNameFromPath(resolvedWorkspace)
    : "Add workspace";

  const visiblePrompts = useMemo(() => {
    if (showCatalog) {
      return promptCatalog;
    }
    return promptCatalog.filter(
      (prompt) => prompt.category === selectedCategory,
    );
  }, [selectedCategory, showCatalog]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/10 text-ink-200">
        <Cloud className="h-6 w-6" />
      </div>
      <div className="mt-6 flex items-center gap-2">
        <h2 className="font-display text-4xl font-semibold text-ink-50">
          Start with a task
        </h2>
        <div className="relative">
          <button
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-ink-300 transition hover:border-flare-300 hover:text-ink-100"
            onClick={() => setCategoryMenuOpen((open) => !open)}
          >
            {showCatalog ? "All" : selectedCategory}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {categoryMenuOpen ? (
            <div className="absolute right-0 top-8 z-30 w-44 rounded-2xl border border-white/10 bg-ink-900/95 p-2 text-left text-[0.7rem] shadow-card">
              {categories.map((category) => (
                <button
                  key={category}
                  className="w-full rounded-xl px-3 py-2 text-left text-ink-200 hover:bg-white/5"
                  onClick={() => {
                    setCategoryMenuOpen(false);
                    setShowCatalog(false);
                    setSelectedCategory(category);
                  }}
                >
                  {category}
                </button>
              ))}
              <button
                className="w-full rounded-xl px-3 py-2 text-left text-ink-200 hover:bg-white/5"
                onClick={() => {
                  setCategoryMenuOpen(false);
                  setShowCatalog(true);
                }}
              >
                All categories
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-4">
        <WorkspacePickerDropdown
          align="left"
          trigger={({ toggle }) => (
            <button
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-ink-300 transition hover:bg-white/5 hover:text-ink-100"
              onClick={toggle}
            >
              {label}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}
        />
      </div>
      <div className="mt-8 grid w-full gap-3 text-left text-sm md:grid-cols-3">
        {visiblePrompts.map((prompt) => (
          <button
            key={prompt.id}
            className="group flex h-28 flex-col justify-between rounded-2xl border border-white/10 bg-black/20 p-4 text-ink-200 transition hover:border-flare-300 hover:bg-black/30 hover:text-ink-50"
            onClick={() => onSelectPrompt(prompt.label)}
          >
            <div className="flex items-center justify-between">
              <span className="text-[0.6rem] uppercase tracking-[0.2em] text-ink-500">
                {prompt.category}
              </span>
              <prompt.Icon className="h-4 w-4 text-ink-400 transition group-hover:text-ink-200" />
            </div>
            <span className="leading-relaxed">{prompt.label}</span>
          </button>
        ))}
      </div>
      <button
        className="mt-6 text-xs uppercase tracking-[0.3em] text-ink-400 transition hover:text-ink-200"
        onClick={() => setShowCatalog((open) => !open)}
      >
        {showCatalog ? "Show less" : "Explore more"}
      </button>
    </div>
  );
}
