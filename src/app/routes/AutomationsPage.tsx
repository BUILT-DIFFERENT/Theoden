import { useEffect, useMemo, useState } from "react";

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
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
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
  const nameInputId = "automation-name";
  const workspaceInputId = "automation-workspace";
  const promptInputId = "automation-prompt";
  const recurrenceInputId = "automation-recurrence";
  const timeInputId = "automation-time";
  const weekdayInputId = "automation-weekday";
  const monthdayInputId = "automation-monthday";

  useEffect(() => {
    if (!modalOpen) return;
    if (workspacePath) return;
    if (!workspaces.length) return;
    setWorkspacePath(workspaces[0].path);
  }, [modalOpen, workspacePath, workspaces]);

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

  const handleClose = () => {
    setModalOpen(false);
    setError(null);
  };

  const handleCreate = () => {
    const trimmedName = name.trim();
    const trimmedPrompt = prompt.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if (!workspacePath) {
      setError("Select a workspace.");
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
    setWorkspacePath(workspaces[0]?.path ?? null);
    setError(null);
    setModalOpen(false);
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
    <div className="space-y-6">
      <section className="surface-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Automations
            </p>
            <h2 className="font-display text-xl">Automate recurring runs</h2>
            <p className="mt-2 text-sm text-ink-300">
              Create schedules with normalized recurrence settings and run each
              job on demand.
            </p>
            <button
              className="btn-flat mt-2 px-0"
              onClick={() =>
                window.open(
                  "https://developers.openai.com/codex/config-reference",
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              Learn more
            </button>
          </div>
          <button className="btn-primary" onClick={() => setModalOpen(true)}>
            + New automation
          </button>
        </div>
        {runMessage ? (
          <p className="mt-3 text-xs text-ink-300">{runMessage}</p>
        ) : null}
      </section>

      <section className="surface-panel p-5">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
          Automations
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
                        ? "Starting…"
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
                                    {event.timestamp} · {event.label}
                                    {event.detail ? ` · ${event.detail}` : ""}
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
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="surface-panel w-full max-w-lg p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-ink-50">
                New automation
              </h3>
              <button className="btn-flat" onClick={handleClose}>
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-ink-300">
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
                  htmlFor={workspaceInputId}
                >
                  Workspace
                </label>
                <select
                  id={workspaceInputId}
                  className="input-base"
                  value={workspacePath ?? ""}
                  onChange={(event) =>
                    setWorkspacePath(event.target.value || null)
                  }
                >
                  <option value="">Select workspace</option>
                  {workspaces.map((workspace) => (
                    <option key={workspace.path} value={workspace.path}>
                      {workspaceNameFromPath(workspace.path)}
                    </option>
                  ))}
                </select>
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
              {error ? <p className="text-xs text-rose-300">{error}</p> : null}
              <div className="flex justify-end gap-2 text-xs">
                <button className="btn-flat" onClick={handleClose}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={handleCreate}>
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
