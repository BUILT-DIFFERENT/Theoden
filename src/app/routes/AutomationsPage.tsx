import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import {
  createAutomation,
  deleteAutomation,
  listAutomationRuns,
  listAutomations,
  listInboxItems,
  markInboxRead,
  runAutomationNow,
  subscribeAutomationStoreUpdates,
  updateAutomation,
  type HostAutomationRecord,
  type HostAutomationRunRecord,
} from "@/app/services/host/automations";
import {
  automationRecurrenceOptions,
  createDefaultRecurrence,
  formatAutomationSchedule,
  formatAutomationTimestamp,
  isAutomationRecurrenceKind,
  loadStoredAutomations,
  recurrenceFromRrule,
  recurrenceToRrule,
  storeAutomations,
  weekdayLabelFromIndex,
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
  const normalized = status.toUpperCase();
  if (normalized === "DONE" || normalized === "COMPLETED") {
    return "border-emerald-400/40 text-emerald-300";
  }
  if (normalized === "FAILED" || normalized === "INTERRUPTED") {
    return "border-rose-400/40 text-rose-300";
  }
  if (
    normalized === "PENDING_REVIEW" ||
    normalized === "NEEDS_REVIEW" ||
    normalized === "IN_REVIEW"
  ) {
    return "border-amber-400/40 text-amber-300";
  }
  if (normalized === "IN_PROGRESS" || normalized === "RUNNING") {
    return "border-sky-400/40 text-sky-300";
  }
  return "border-white/20 text-ink-400";
}

function enabledFromStatus(status: string) {
  const normalized = status.toUpperCase();
  return normalized !== "PAUSED" && normalized !== "DISABLED";
}

function recurringSummary(record: HostAutomationRecord) {
  const recurrence = recurrenceFromRrule(record.rrule);
  return formatAutomationSchedule(recurrence);
}

export function AutomationsPage() {
  const queryClient = useQueryClient();
  const { workspaces } = useWorkspaces();
  const isDesktop = isTauri();
  const migrationAttemptedRef = useRef(false);

  const automationsQuery = useQuery({
    queryKey: ["host", "automations"],
    queryFn: listAutomations,
    enabled: isDesktop,
    refetchOnWindowFocus: isDesktop,
  });
  const runsQuery = useQuery({
    queryKey: ["host", "automation-runs"],
    queryFn: () => listAutomationRuns(),
    enabled: isDesktop,
    refetchOnWindowFocus: isDesktop,
  });
  const inboxQuery = useQuery({
    queryKey: ["host", "inbox-items"],
    queryFn: listInboxItems,
    enabled: isDesktop,
    refetchOnWindowFocus: isDesktop,
  });

  useEffect(() => {
    if (!isDesktop) {
      return;
    }
    let unlisten: (() => void) | null = null;
    void subscribeAutomationStoreUpdates(() => {
      void queryClient.invalidateQueries({ queryKey: ["host", "automations"] });
      void queryClient.invalidateQueries({
        queryKey: ["host", "automation-runs"],
      });
      void queryClient.invalidateQueries({ queryKey: ["host", "inbox-items"] });
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => {
      unlisten?.();
    };
  }, [isDesktop, queryClient]);

  useEffect(() => {
    if (!isDesktop) return;
    if (migrationAttemptedRef.current) return;
    if (automationsQuery.isLoading) return;
    if ((automationsQuery.data ?? []).length > 0) {
      migrationAttemptedRef.current = true;
      return;
    }
    migrationAttemptedRef.current = true;
    const legacy = loadStoredAutomations();
    if (!legacy.length) {
      return;
    }
    void (async () => {
      for (const item of legacy) {
        await createAutomation({
          name: item.name,
          prompt: item.prompt,
          status: item.enabled ? "ACTIVE" : "PAUSED",
          nextRunAt: item.nextRunAt,
          lastRunAt: item.lastRunAt,
          cwds: [item.workspacePath],
          rrule: recurrenceToRrule(item.recurrence),
        });
      }
      storeAutomations([]);
      void queryClient.invalidateQueries({ queryKey: ["host", "automations"] });
    })();
  }, [
    automationsQuery.data,
    automationsQuery.isLoading,
    isDesktop,
    queryClient,
  ]);

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

  const automations = automationsQuery.data ?? [];
  const inboxItems = inboxQuery.data ?? [];
  const runsByAutomation = useMemo(() => {
    const runs = runsQuery.data ?? [];
    const map = new Map<string, HostAutomationRunRecord[]>();
    runs.forEach((run) => {
      const current = map.get(run.automationId);
      if (current) {
        current.push(run);
      } else {
        map.set(run.automationId, [run]);
      }
    });
    return map;
  }, [runsQuery.data]);

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
    if (!sheetOpen) return;
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

  useEffect(() => {
    if (!runMessage) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setRunMessage(null);
    }, 3000);
    return () => window.clearTimeout(timeoutId);
  }, [runMessage]);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    const trimmedPrompt = prompt.trim();
    const primaryWorkspacePath = selectedProjects[0] ?? null;
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if (!selectedProjects.length) {
      setError("Select at least one project.");
      return;
    }
    if (!trimmedPrompt) {
      setError("Prompt is required.");
      return;
    }
    if (!primaryWorkspacePath) {
      setError("Select at least one project.");
      return;
    }

    const defaultRecurrence = createDefaultRecurrence();
    const recurrence = {
      kind: recurrenceKind,
      time: runTime || defaultRecurrence.time,
      timezone: defaultRecurrence.timezone,
      dayOfWeek: recurrenceKind === "weekly" ? dayOfWeek : null,
      dayOfMonth: recurrenceKind === "monthly" ? dayOfMonth : null,
    };
    await createAutomation({
      name: trimmedName,
      prompt: trimmedPrompt,
      status: "ACTIVE",
      nextRunAt: null,
      lastRunAt: null,
      cwds: selectedProjects,
      rrule: recurrenceToRrule(recurrence),
    });
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
    await queryClient.invalidateQueries({ queryKey: ["host", "automations"] });
  };

  const toggleAutomation = async (automation: HostAutomationRecord) => {
    await updateAutomation({
      id: automation.id,
      status: enabledFromStatus(automation.status) ? "PAUSED" : "ACTIVE",
    });
    await queryClient.invalidateQueries({ queryKey: ["host", "automations"] });
  };

  const handleRunNow = async (automation: HostAutomationRecord) => {
    if (!isDesktop) {
      setRunMessage("Run now is available in the desktop app.");
      return;
    }
    setRunningAutomationIds((current) => new Set(current).add(automation.id));
    try {
      await runAutomationNow(automation.id);
      setRunMessage(`${automation.name} started.`);
      await queryClient.invalidateQueries({
        queryKey: ["host", "automation-runs"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["host", "inbox-items"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["host", "automations"],
      });
    } catch (runError) {
      const message =
        runError instanceof Error ? runError.message : "Run failed to start.";
      setRunMessage(message);
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
              </button>
            );
          })}
        </div>
      </section>

      <section className="surface-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
            Scheduled threads
          </p>
          <p className="text-xs text-ink-400">
            Inbox pending: {inboxItems.filter((item) => !item.readAt).length}
          </p>
        </div>
        <div className="mt-4 space-y-3">
          {automations.length ? (
            automations.map((automation) => {
              const runHistory = runsByAutomation.get(automation.id) ?? [];
              const latestRun = runHistory[0];
              const historyOpen = expandedHistory.has(automation.id);
              const enabled = enabledFromStatus(automation.status);
              return (
                <div key={automation.id} className="surface-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-ink-100">{automation.name}</p>
                      <p className="text-xs text-ink-500">
                        {automation.cwds.length
                          ? automation.cwds
                              .map(workspaceNameFromPath)
                              .join(", ")
                          : "No project"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-[0.65rem] ${runStatusClass(latestRun?.status ?? "idle")}`}
                    >
                      {latestRun?.status ?? automation.status}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-ink-400">
                    {recurringSummary(automation)}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    Last run:{" "}
                    {formatAutomationTimestamp(
                      latestRun?.createdAt ?? automation.lastRunAt ?? null,
                    )}
                  </p>
                  <p className="text-xs text-ink-500">
                    Next run: {formatAutomationTimestamp(automation.nextRunAt)}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <button
                      className={`rounded-full border px-3 py-1 ${
                        enabled
                          ? "border-emerald-300/30 text-emerald-200 hover:border-emerald-200/50"
                          : "border-white/10 text-ink-300 hover:border-flare-300"
                      }`}
                      onClick={() => {
                        void toggleAutomation(automation);
                      }}
                    >
                      {enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      className="rounded-full border border-white/10 px-3 py-1 text-ink-300 hover:border-flare-300"
                      onClick={() => {
                        void handleRunNow(automation);
                      }}
                      disabled={runningAutomationIds.has(automation.id)}
                    >
                      {runningAutomationIds.has(automation.id)
                        ? "Starting…"
                        : "Run now"}
                    </button>
                    <button
                      className="rounded-full border border-white/10 px-3 py-1 text-ink-300 hover:border-flare-300"
                      onClick={() => toggleHistory(automation.id)}
                    >
                      {historyOpen ? "Hide history" : "Show history"}
                    </button>
                    <button
                      className="rounded-full border border-white/10 px-3 py-1 text-rose-300 hover:border-rose-300/60"
                      onClick={() => {
                        void deleteAutomation(automation.id).then(() => {
                          void queryClient.invalidateQueries({
                            queryKey: ["host", "automations"],
                          });
                        });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                  {historyOpen ? (
                    <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
                      {runHistory.length ? (
                        runHistory.slice(0, 10).map((run) => (
                          <div
                            key={run.id}
                            className="flex items-center justify-between gap-2"
                          >
                            <div>
                              <p className="text-ink-200">{run.status}</p>
                              <p className="text-ink-500">
                                {formatAutomationTimestamp(run.createdAt)}
                              </p>
                            </div>
                            {run.readAt ? null : (
                              <button
                                className="rounded-full border border-white/10 px-2 py-1 text-[0.65rem] text-ink-300 hover:border-flare-300"
                                onClick={() => {
                                  if (!run.id) return;
                                  const inboxItem = inboxItems.find(
                                    (item) => item.threadId === run.threadId,
                                  );
                                  if (!inboxItem) return;
                                  void markInboxRead(inboxItem.id).then(() => {
                                    void queryClient.invalidateQueries({
                                      queryKey: ["host", "inbox-items"],
                                    });
                                  });
                                }}
                              >
                                Mark inbox read
                              </button>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-ink-500">No run history yet.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : automationsQuery.isLoading ? (
            <p className="text-sm text-ink-400">Loading automations…</p>
          ) : (
            <p className="text-sm text-ink-400">
              No automations yet. Start from a template.
            </p>
          )}
        </div>
      </section>

      {runMessage ? <p className="text-sm text-ink-300">{runMessage}</p> : null}

      {sheetOpen ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50 animate-codex-dialog-overlay">
          <button
            type="button"
            aria-label="Close create automation sheet"
            className="absolute inset-0 cursor-default bg-transparent"
            onClick={closeCreateSheet}
          />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            className="surface-panel animate-codex-dialog-enter relative z-10 h-full w-full max-w-xl overflow-y-auto rounded-none border-l border-white/10 p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
                  Create automation
                </p>
                <h2 className="mt-2 font-display text-2xl text-ink-50">
                  Scheduled thread
                </h2>
              </div>
              <button
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-ink-300 hover:border-flare-300"
                onClick={closeCreateSheet}
              >
                Close
              </button>
            </div>
            <div className="mt-6 rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-xs text-rose-100">
              <p className="font-medium">
                Automations can run commands unattended in your projects.
              </p>
              <p className="mt-1 text-rose-200/90">
                Review your sandbox and approvals before enabling schedules. See{" "}
                <a
                  className="underline decoration-rose-200/70 underline-offset-2 transition hover:text-rose-100"
                  href="https://developers.openai.com/codex/security/"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  rules
                </a>{" "}
                and{" "}
                <a
                  className="underline decoration-rose-200/70 underline-offset-2 transition hover:text-rose-100"
                  href="https://developers.openai.com/codex/"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  settings guidance
                </a>
                .
              </p>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-ink-400">
                  Name
                </span>
                <input
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-ink-100"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Daily release notes"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-ink-400">
                  Projects
                </span>
                <select
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-ink-100"
                  value={projectPicker}
                  onChange={(event) => {
                    const selected = event.target.value;
                    setProjectPicker(selected);
                    if (selected) {
                      addProject(selected);
                      setProjectPicker("");
                    }
                  }}
                >
                  <option value="">Select project</option>
                  {availableWorkspaceOptions.map((workspace) => (
                    <option key={workspace.path} value={workspace.path}>
                      {workspace.label}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  {selectedProjects.map((path) => (
                    <button
                      key={path}
                      className="rounded-full border border-white/10 px-2 py-1 text-xs text-ink-200 hover:border-flare-300"
                      onClick={() => removeProject(path)}
                    >
                      {workspaceNameFromPath(path)} ×
                    </button>
                  ))}
                </div>
                {!workspaceOptions.length ? (
                  <p className="text-xs text-ink-500">
                    No projects detected yet. Add a workspace to schedule runs.
                  </p>
                ) : null}
              </label>
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-ink-400">
                  Prompt
                </span>
                <textarea
                  className="min-h-28 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-ink-100"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-ink-400">
                    Recurrence
                  </span>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-ink-100"
                    value={recurrenceKind}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      if (!isAutomationRecurrenceKind(nextValue)) return;
                      setRecurrenceKind(nextValue);
                    }}
                  >
                    {automationRecurrenceOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-ink-400">
                    Time
                  </span>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-ink-100"
                    type="time"
                    value={runTime}
                    onChange={(event) => setRunTime(event.target.value)}
                  />
                </label>
              </div>
              {recurrenceKind === "weekly" ? (
                <label className="block space-y-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-ink-400">
                    Day of week
                  </span>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-ink-100"
                    value={dayOfWeek}
                    onChange={(event) => {
                      setDayOfWeek(Number.parseInt(event.target.value, 10));
                    }}
                  >
                    {WEEKDAY_OPTIONS.map((day) => (
                      <option key={day} value={day}>
                        {weekdayLabelFromIndex(day)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {recurrenceKind === "monthly" ? (
                <label className="block space-y-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-ink-400">
                    Day of month
                  </span>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-ink-100"
                    value={dayOfMonth}
                    onChange={(event) => {
                      setDayOfMonth(Number.parseInt(event.target.value, 10));
                    }}
                  >
                    {MONTH_DAY_OPTIONS.map((day) => (
                      <option key={day} value={day}>
                        Day {day}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            {error ? (
              <p className="mt-4 text-sm text-rose-300">{error}</p>
            ) : null}
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                className="rounded-full border border-white/10 px-4 py-2 text-xs text-ink-300 hover:border-flare-300"
                onClick={closeCreateSheet}
              >
                Cancel
              </button>
              <button
                className="rounded-full border border-flare-300 bg-flare-400/10 px-4 py-2 text-xs text-ink-50 hover:bg-flare-400/20"
                onClick={() => {
                  void handleCreate();
                }}
              >
                Create automation
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
