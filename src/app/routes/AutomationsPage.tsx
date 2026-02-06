import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  recordAutomationRunFailure,
  recordAutomationRunStart,
} from "@/app/services/cli/automationRuns";
import { startThread, startTurn } from "@/app/services/cli/turns";
import { useAutomationRuns } from "@/app/services/cli/useAutomationRuns";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import {
  automationRecurrenceOptions,
  computeNextRunAt,
  createDefaultRecurrence,
  formatAutomationSchedule,
  formatAutomationTimestamp,
  isAutomationRecurrenceKind,
  loadStoredAutomations,
  storeAutomations,
  weekdayLabelFromIndex,
  type AutomationItem,
  type AutomationRecurrenceKind,
} from "@/app/state/automations";
import { isTauri } from "@/app/utils/tauri";
import { workspaceNameFromPath } from "@/app/utils/workspace";

const WEEKDAY_OPTIONS = [0, 1, 2, 3, 4, 5, 6] as const;
const MONTH_DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => index + 1);
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface AutomationTemplate {
  id: string;
  iconLabel: string;
  title: string;
  description: string;
  prompt: string;
  defaultName: string;
  recurrenceKind: AutomationRecurrenceKind;
  time: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
}

const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "release-notes",
    iconLabel: "RN",
    title: "Daily release notes",
    description:
      "Summarize merged PRs, unresolved comments, and draft release notes.",
    prompt:
      "Summarize merged PRs from the last 24 hours and draft release notes with risks and follow-ups.",
    defaultName: "Daily release notes",
    recurrenceKind: "daily",
    time: "09:00",
  },
  {
    id: "dependency-health",
    iconLabel: "DH",
    title: "Dependency health check",
    description:
      "Review outdated dependencies and highlight updates that need manual review.",
    prompt:
      "Check for outdated dependencies, propose safe updates, and list packages that need manual validation.",
    defaultName: "Dependency health check",
    recurrenceKind: "weekly",
    time: "10:00",
    dayOfWeek: 1,
  },
  {
    id: "bug-triage",
    iconLabel: "BT",
    title: "Bug triage digest",
    description:
      "Collect new issues, deduplicate obvious repeats, and suggest owners.",
    prompt:
      "Collect issues opened since yesterday, group duplicates, and suggest an owner and priority for each.",
    defaultName: "Bug triage digest",
    recurrenceKind: "daily",
    time: "11:00",
  },
  {
    id: "changelog",
    iconLabel: "CL",
    title: "Weekly changelog draft",
    description:
      "Generate changelog sections grouped by feature area and migration impact.",
    prompt:
      "Draft a weekly changelog grouped by feature area with migration notes and known regressions.",
    defaultName: "Weekly changelog draft",
    recurrenceKind: "weekly",
    time: "16:00",
    dayOfWeek: 5,
  },
];

function runStatusClass(status: string) {
  if (status === "done") return "border-emerald-400/40 text-emerald-300";
  if (status === "failed") return "border-rose-400/40 text-rose-300";
  if (status === "needs_review") return "border-amber-400/40 text-amber-300";
  if (status === "running") return "border-sky-400/40 text-sky-300";
  return "border-white/20 text-ink-400";
}

export function AutomationsPage() {
  const { workspaces } = useWorkspaces();
  const allRuns = useAutomationRuns();
  const [automations, setAutomations] = useState<AutomationItem[]>(() =>
    loadStoredAutomations(),
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [projectPicker, setProjectPicker] = useState("");
  const [prompt, setPrompt] = useState("");
  const [recurrenceKind, setRecurrenceKind] =
    useState<AutomationRecurrenceKind>("daily");
  const [runTime, setRunTime] = useState("09:00");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [runningAutomationIds, setRunningAutomationIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(
    () => new Set(),
  );
  const sheetRef = useRef<HTMLDivElement | null>(null);

  const nameInputId = "automation-name";
  const projectsInputId = "automation-projects";
  const projectPickerInputId = "automation-project-picker";
  const promptInputId = "automation-prompt";
  const recurrenceInputId = "automation-recurrence";
  const timeInputId = "automation-time";
  const weekdayInputId = "automation-weekday";
  const monthdayInputId = "automation-monthday";

  useEffect(() => {
    if (!sheetOpen) return;
    if (selectedProjects.length) return;
    if (!workspaces.length) return;
    setSelectedProjects([workspaces[0].path]);
  }, [selectedProjects.length, sheetOpen, workspaces]);

  useEffect(() => {
    storeAutomations(automations);
  }, [automations]);

  useEffect(() => {
    if (!runMessage) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setRunMessage(null);
    }, 3000);
    return () => window.clearTimeout(timeoutId);
  }, [runMessage]);

  const workspaceOptions = useMemo(
    () =>
      workspaces.map((workspace) => ({
        path: workspace.path,
        label: workspaceNameFromPath(workspace.path),
      })),
    [workspaces],
  );

  const availableWorkspaceOptions = useMemo(
    () =>
      workspaceOptions.filter(
        (workspace) => !selectedProjects.includes(workspace.path),
      ),
    [selectedProjects, workspaceOptions],
  );

  const runsByAutomation = useMemo(() => {
    const map = new Map<string, typeof allRuns>();
    allRuns.forEach((run) => {
      const current = map.get(run.automationId);
      if (current) {
        current.push(run);
      } else {
        map.set(run.automationId, [run]);
      }
    });
    return map;
  }, [allRuns]);

  const closeCreateSheet = useCallback(() => {
    setSheetOpen(false);
    setError(null);
    setActiveTemplateId(null);
    setProjectPicker("");
  }, []);

  const openCreateSheet = useCallback(
    (template?: AutomationTemplate) => {
      const defaultWorkspacePath = workspaces[0]?.path;
      setActiveTemplateId(template?.id ?? null);
      setName(template?.defaultName ?? "");
      setPrompt(template?.prompt ?? "");
      setRecurrenceKind(template?.recurrenceKind ?? "daily");
      setRunTime(template?.time ?? "09:00");
      setDayOfWeek(template?.dayOfWeek ?? 1);
      setDayOfMonth(template?.dayOfMonth ?? 1);
      setSelectedProjects(defaultWorkspacePath ? [defaultWorkspacePath] : []);
      setProjectPicker("");
      setError(null);
      setSheetOpen(true);
    },
    [workspaces],
  );

  useEffect(() => {
    if (!sheetOpen) {
      return;
    }
    const previouslyFocused = document.activeElement;
    const frame = window.requestAnimationFrame(() => {
      const focusables =
        sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      focusables?.[0]?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCreateSheet();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusables = Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ??
          [],
      );
      if (!focusables.length) {
        return;
      }
      const firstElement = focusables[0];
      const lastElement = focusables[focusables.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;
      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [closeCreateSheet, sheetOpen]);

  const addProject = (path: string) => {
    if (!path || selectedProjects.includes(path)) {
      return;
    }
    setSelectedProjects((current) => [...current, path]);
  };

  const removeProject = (path: string) => {
    setSelectedProjects((current) =>
      current.filter((projectPath) => projectPath !== path),
    );
  };

  const handleCreate = () => {
    const trimmedName = name.trim();
    const trimmedPrompt = prompt.trim();
    const workspacePath = selectedProjects[0] ?? null;

    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if (!workspacePath) {
      setError("Select at least one project.");
      return;
    }
    if (!trimmedPrompt) {
      setError("Prompt is required.");
      return;
    }

    const createdAt = Date.now();
    const defaultRecurrence = createDefaultRecurrence();
    const recurrence = {
      kind: recurrenceKind,
      time: runTime || defaultRecurrence.time,
      timezone: defaultRecurrence.timezone,
      dayOfWeek: recurrenceKind === "weekly" ? dayOfWeek : null,
      dayOfMonth: recurrenceKind === "monthly" ? dayOfMonth : null,
    };
    const automation: AutomationItem = {
      id: `automation-${createdAt}`,
      name: trimmedName,
      workspacePath,
      prompt: trimmedPrompt,
      recurrence,
      createdAt,
      enabled: true,
      lastRunAt: null,
      nextRunAt: computeNextRunAt(recurrence, createdAt),
    };

    setAutomations((current) => [automation, ...current]);
    setName("");
    setPrompt("");
    setRecurrenceKind("daily");
    setRunTime("09:00");
    setDayOfWeek(1);
    setDayOfMonth(1);
    setSelectedProjects(workspaces[0]?.path ? [workspaces[0].path] : []);
    setProjectPicker("");
    setError(null);
    setSheetOpen(false);
    setActiveTemplateId(null);
  };

  const toggleAutomation = (id: string) => {
    setAutomations((current) =>
      current.map((automation) =>
        automation.id === id
          ? { ...automation, enabled: !automation.enabled }
          : automation,
      ),
    );
  };

  const handleRunNow = async (automation: AutomationItem) => {
    if (!isTauri()) {
      setRunMessage("Run now is available in the desktop app.");
      return;
    }

    setRunningAutomationIds((current) => {
      const next = new Set(current);
      next.add(automation.id);
      return next;
    });

    try {
      const thread = await startThread({ cwd: automation.workspacePath });
      const threadId = thread?.id;
      if (!threadId) {
        throw new Error("Unable to create run thread.");
      }

      const turn = await startTurn({
        threadId,
        input: automation.prompt,
        cwd: automation.workspacePath,
      });

      recordAutomationRunStart({
        automationId: automation.id,
        threadId,
        turnId: turn?.id ?? null,
        prompt: automation.prompt,
        workspacePath: automation.workspacePath,
      });

      setAutomations((current) =>
        current.map((item) =>
          item.id === automation.id
            ? {
                ...item,
                lastRunAt: Date.now(),
                nextRunAt: computeNextRunAt(item.recurrence),
              }
            : item,
        ),
      );
      setRunMessage(`${automation.name} started.`);
    } catch (runError) {
      const errorMessage =
        runError instanceof Error ? runError.message : "Run failed to start.";
      recordAutomationRunFailure({
        automationId: automation.id,
        workspacePath: automation.workspacePath,
        prompt: automation.prompt,
        errorMessage,
      });
      setRunMessage(errorMessage);
    } finally {
      setRunningAutomationIds((current) => {
        const next = new Set(current);
        next.delete(automation.id);
        return next;
      });
    }
  };

  const toggleHistory = (automationId: string) => {
    setExpandedHistory((current) => {
      const next = new Set(current);
      if (next.has(automationId)) {
        next.delete(automationId);
      } else {
        next.add(automationId);
      }
      return next;
    });
  };

  return (
    <div className="relative min-h-[70vh] space-y-6 pb-8">
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-3xl text-ink-50">Automations</h1>
          <span className="rounded-full border border-sky-300/40 bg-sky-500/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] text-sky-200">
            Beta
          </span>
        </div>
        <p className="max-w-3xl text-sm text-ink-300">
          Automate work by setting up scheduled threads.{" "}
          <a
            className="text-sky-300 transition hover:text-sky-200"
            href="https://developers.openai.com/codex/"
            rel="noopener noreferrer"
            target="_blank"
          >
            Learn more
          </a>
          .
        </p>
      </section>

      <section className="surface-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-ink-100">
              Start with a template
            </h2>
            <p className="mt-2 text-sm text-ink-300">
              Kick off a scheduled workflow quickly, then tailor the prompt and
              recurrence in the create sheet.
            </p>
          </div>
          <button className="btn-primary" onClick={() => openCreateSheet()}>
            + Create automation
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {AUTOMATION_TEMPLATES.map((template) => {
            const isActive = activeTemplateId === template.id && sheetOpen;
            return (
              <button
                key={template.id}
                className={`surface-card h-full p-4 text-left transition ${
                  isActive
                    ? "border-flare-300/60 bg-flare-400/10 shadow-glow"
                    : "hover:border-white/30 hover:bg-black/30"
                }`}
                onClick={() => openCreateSheet(template)}
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/20 bg-black/30 text-xs font-semibold text-ink-100">
                  {template.iconLabel}
                </span>
                <p className="mt-3 text-sm text-ink-100">{template.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-300">
                  {template.description}
                </p>
                <div className="mt-3 flex items-center justify-between text-[0.65rem]">
                  <span className="rounded-full border border-white/15 px-2 py-0.5 uppercase tracking-[0.18em] text-ink-400">
                    {template.recurrenceKind}
                  </span>
                  <span className="text-flare-200">Use template</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="surface-panel p-5">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
          Scheduled threads
        </p>
        <div className="mt-4 space-y-3">
          {automations.length ? (
            automations.map((automation) => {
              const runs = runsByAutomation.get(automation.id) ?? [];
              const latestRun = runs[0];
              const lastRunAt = latestRun?.startedAt ?? automation.lastRunAt;
              const nextRunAt =
                latestRun && latestRun.completedAt
                  ? computeNextRunAt(
                      automation.recurrence,
                      latestRun.completedAt,
                    )
                  : automation.nextRunAt;
              const runStatus = latestRun?.status ?? "queued";
              const historyOpen = expandedHistory.has(automation.id);
              return (
                <div key={automation.id} className="surface-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-ink-100">{automation.name}</p>
                      <p className="text-xs text-ink-500">
                        {workspaceNameFromPath(automation.workspacePath)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-[0.65rem] ${runStatusClass(runStatus)}`}
                    >
                      {automation.enabled
                        ? latestRun
                          ? latestRun.statusLabel
                          : "Enabled"
                        : "Paused"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-ink-300">
                    {automation.prompt}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.7rem] text-ink-400">
                    <span>
                      Schedule:{" "}
                      {formatAutomationSchedule(automation.recurrence)}
                    </span>
                    <span>
                      Last run: {formatAutomationTimestamp(lastRunAt)}
                    </span>
                    <span>
                      Next run: {formatAutomationTimestamp(nextRunAt)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <button
                      className="btn-flat"
                      onClick={() => toggleAutomation(automation.id)}
                    >
                      {automation.enabled ? "Pause" : "Enable"}
                    </button>
                    <button
                      className="btn-flat"
                      onClick={() => {
                        void handleRunNow(automation);
                      }}
                      disabled={runningAutomationIds.has(automation.id)}
                    >
                      {runningAutomationIds.has(automation.id)
                        ? "Starting..."
                        : "Run now"}
                    </button>
                    <button
                      className="btn-flat"
                      onClick={() => toggleHistory(automation.id)}
                    >
                      {historyOpen
                        ? "Hide execution history"
                        : `Execution history (${runs.length})`}
                    </button>
                  </div>
                  {historyOpen ? (
                    <div className="mt-3 rounded-xl border border-white/10 bg-black/15 p-3">
                      {runs.length ? (
                        <div className="space-y-3 text-xs">
                          {runs.slice(0, 8).map((run) => (
                            <div
                              key={run.id}
                              className="rounded-lg border border-white/10 bg-black/20 p-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-ink-200">
                                  {formatAutomationTimestamp(run.startedAt)}
                                </span>
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[0.65rem] ${runStatusClass(run.status)}`}
                                >
                                  {run.statusLabel}
                                </span>
                              </div>
                              <p className="mt-1 text-[0.7rem] text-ink-400">
                                Thread: {run.threadId}
                              </p>
                              <div className="mt-2 space-y-1">
                                {run.events.slice(-3).map((event) => (
                                  <p
                                    key={event.id}
                                    className="text-[0.65rem] text-ink-400"
                                  >
                                    {event.timestamp} . {event.label}
                                    {event.detail ? ` . ${event.detail}` : ""}
                                  </p>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[0.7rem] text-ink-500">
                          No execution history yet.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="surface-card p-4 text-xs text-ink-400">
              No automations yet.
            </div>
          )}
        </div>
        {runMessage ? (
          <p className="mt-3 text-xs text-ink-300">{runMessage}</p>
        ) : null}
      </section>

      {sheetOpen ? (
        <>
          <button
            aria-label="Close automation sheet"
            className="absolute inset-0 z-40 cursor-default bg-black/45"
            onClick={closeCreateSheet}
            type="button"
          />
          <aside className="absolute inset-y-0 right-0 z-50 w-full max-w-2xl pl-4">
            <div
              aria-label="Create automation"
              aria-modal="true"
              className="surface-panel flex h-full flex-col rounded-r-none border-r-0 p-5"
              ref={sheetRef}
              role="dialog"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-ink-500">
                    Create automation
                  </p>
                  <h3 className="mt-1 font-display text-lg text-ink-50">
                    Configure scheduled thread
                  </h3>
                </div>
                <button className="btn-flat" onClick={closeCreateSheet}>
                  Close
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-rose-300/40 bg-rose-500/10 p-3 text-xs text-rose-100">
                <p className="font-medium">
                  Automation runs can execute shell commands.
                </p>
                <p className="mt-1 text-rose-200/90">
                  Review sandbox{" "}
                  <a
                    className="text-rose-100 underline"
                    href="https://developers.openai.com/codex/security/"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    rules
                  </a>{" "}
                  and{" "}
                  <a
                    className="text-rose-100 underline"
                    href="https://developers.openai.com/codex/config-reference"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    settings
                  </a>{" "}
                  before enabling production schedules.
                </p>
              </div>

              <div className="codex-scrollbar mt-4 flex-1 space-y-4 overflow-y-auto pr-1 text-sm text-ink-300">
                <div className="space-y-2">
                  <label
                    className="text-xs uppercase tracking-[0.2em] text-ink-500"
                    htmlFor={nameInputId}
                  >
                    Name
                  </label>
                  <input
                    id={nameInputId}
                    className="input-base"
                    placeholder="Daily release notes"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="text-xs uppercase tracking-[0.2em] text-ink-500"
                    htmlFor={projectsInputId}
                  >
                    Projects
                  </label>
                  <div
                    className="rounded-xl border border-white/10 bg-black/25 p-2"
                    id={projectsInputId}
                  >
                    {selectedProjects.length ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedProjects.map((projectPath) => (
                          <span
                            key={projectPath}
                            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/25 px-2 py-1 text-xs text-ink-200"
                          >
                            {workspaceNameFromPath(projectPath)}
                            <button
                              aria-label={`Remove ${workspaceNameFromPath(projectPath)}`}
                              className="text-ink-400 transition hover:text-ink-100"
                              onClick={() => removeProject(projectPath)}
                              type="button"
                            >
                              x
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="px-1 py-1 text-xs text-ink-500">
                        Select at least one workspace.
                      </p>
                    )}
                  </div>
                  <select
                    className="input-base"
                    id={projectPickerInputId}
                    onChange={(event) => {
                      const value = event.target.value;
                      addProject(value);
                      setProjectPicker("");
                    }}
                    value={projectPicker}
                  >
                    <option value="">Add project</option>
                    {availableWorkspaceOptions.map((workspace) => (
                      <option key={workspace.path} value={workspace.path}>
                        {workspace.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[0.7rem] text-ink-500">
                    The first selected project is used when starting this
                    automation.
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    className="text-xs uppercase tracking-[0.2em] text-ink-500"
                    htmlFor={promptInputId}
                  >
                    Prompt
                  </label>
                  <textarea
                    id={promptInputId}
                    className="textarea-base"
                    placeholder="Summarize yesterday's changes and open a PR."
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      className="text-xs uppercase tracking-[0.2em] text-ink-500"
                      htmlFor={recurrenceInputId}
                    >
                      Recurrence
                    </label>
                    <select
                      id={recurrenceInputId}
                      className="input-base"
                      value={recurrenceKind}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (isAutomationRecurrenceKind(nextValue)) {
                          setRecurrenceKind(nextValue);
                        }
                      }}
                    >
                      {automationRecurrenceOptions.map((option) => (
                        <option key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-xs uppercase tracking-[0.2em] text-ink-500"
                      htmlFor={timeInputId}
                    >
                      Time
                    </label>
                    <input
                      id={timeInputId}
                      type="time"
                      className="input-base"
                      value={runTime}
                      onChange={(event) => setRunTime(event.target.value)}
                    />
                  </div>
                </div>

                {recurrenceKind === "weekly" ? (
                  <div className="space-y-2">
                    <label
                      className="text-xs uppercase tracking-[0.2em] text-ink-500"
                      htmlFor={weekdayInputId}
                    >
                      Day of week
                    </label>
                    <select
                      id={weekdayInputId}
                      className="input-base"
                      value={dayOfWeek}
                      onChange={(event) =>
                        setDayOfWeek(Number.parseInt(event.target.value, 10))
                      }
                    >
                      {WEEKDAY_OPTIONS.map((weekday) => (
                        <option key={weekday} value={weekday}>
                          {weekdayLabelFromIndex(weekday)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {recurrenceKind === "monthly" ? (
                  <div className="space-y-2">
                    <label
                      className="text-xs uppercase tracking-[0.2em] text-ink-500"
                      htmlFor={monthdayInputId}
                    >
                      Day of month
                    </label>
                    <select
                      id={monthdayInputId}
                      className="input-base"
                      value={dayOfMonth}
                      onChange={(event) =>
                        setDayOfMonth(Number.parseInt(event.target.value, 10))
                      }
                    >
                      {MONTH_DAY_OPTIONS.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {error ? (
                  <p className="text-xs text-rose-300">{error}</p>
                ) : null}
              </div>

              <div className="mt-4 flex justify-end gap-2 border-t border-white/10 pt-4 text-xs">
                <button className="btn-flat" onClick={closeCreateSheet}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={handleCreate}>
                  Create
                </button>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
