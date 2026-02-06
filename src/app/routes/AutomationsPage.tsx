import { useEffect, useState } from "react";

import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import {
  automationRecurrenceOptions,
  isAutomationRecurrence,
  loadStoredAutomations,
  storeAutomations,
  type AutomationItem,
} from "@/app/state/automations";
import { workspaceNameFromPath } from "@/app/utils/workspace";

export function AutomationsPage() {
  const { workspaces } = useWorkspaces();
  const [automations, setAutomations] = useState<AutomationItem[]>(() =>
    loadStoredAutomations(),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [recurrence, setRecurrence] =
    useState<(typeof automationRecurrenceOptions)[number]>("Daily");
  const [runTime, setRunTime] = useState("09:00");
  const [error, setError] = useState<string | null>(null);
  const nameInputId = "automation-name";
  const workspaceInputId = "automation-workspace";
  const promptInputId = "automation-prompt";
  const recurrenceInputId = "automation-recurrence";
  const timeInputId = "automation-time";

  useEffect(() => {
    if (!modalOpen) return;
    if (workspacePath) return;
    if (!workspaces.length) return;
    setWorkspacePath(workspaces[0].path);
  }, [modalOpen, workspacePath, workspaces]);

  useEffect(() => {
    storeAutomations(automations);
  }, [automations]);

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
    const schedule = `${recurrence} at ${runTime}`;
    const nextRun = `${recurrence} at ${runTime}`;
    const automation: AutomationItem = {
      id: `automation-${createdAt}`,
      name: trimmedName,
      workspacePath,
      prompt: trimmedPrompt,
      recurrence,
      runTime,
      createdAt,
      enabled: true,
      schedule,
      lastRun: "Never",
      nextRun,
    };
    console.warn("Create automation", {
      name: automation.name,
      recurrence,
      runTime,
    });
    setAutomations((current) => [automation, ...current]);
    setName("");
    setPrompt("");
    setRecurrence("Daily");
    setRunTime("09:00");
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

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Automations
            </p>
            <h2 className="font-display text-xl">Let&apos;s automate</h2>
            <p className="mt-2 text-sm text-ink-300">
              Schedule recurring runs, spawn new threads, and reuse prompt
              templates.
            </p>
            <button className="mt-2 text-xs uppercase tracking-[0.3em] text-ink-400 transition hover:text-ink-200">
              Learn more
            </button>
          </div>
          <button
            className="rounded-full border border-flare-300 bg-flare-400/10 px-4 py-2 text-xs text-ink-50 hover:bg-flare-400/20"
            onClick={() => setModalOpen(true)}
          >
            + New automation
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
          Automations
        </p>
        <div className="mt-4 space-y-3">
          {automations.length ? (
            automations.map((automation) => (
              <div
                key={automation.id}
                className="rounded-xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-ink-100">{automation.name}</p>
                    <p className="text-xs text-ink-500">
                      {workspaceNameFromPath(automation.workspacePath)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-1 text-[0.65rem] ${
                      automation.enabled
                        ? "border-emerald-400/40 text-emerald-300"
                        : "border-white/20 text-ink-400"
                    }`}
                  >
                    {automation.enabled ? "Enabled" : "Paused"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-300">{automation.prompt}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.7rem] text-ink-400">
                  <span>Schedule: {automation.schedule}</span>
                  <span>Last run: {automation.lastRun}</span>
                  <span>Next run: {automation.nextRun}</span>
                </div>
                <div className="mt-3">
                  <button
                    className="rounded-full border border-white/10 px-3 py-1 text-xs hover:border-flare-300"
                    onClick={() => toggleAutomation(automation.id)}
                  >
                    {automation.enabled ? "Pause" : "Enable"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-ink-400">
              No automations yet.
            </div>
          )}
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-ink-900/95 p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-ink-50">
                New automation
              </h3>
              <button
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-ink-300 hover:border-flare-300"
                onClick={handleClose}
              >
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
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-ink-100"
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
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-ink-100"
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
                  className="h-24 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-ink-100"
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
                    Schedule
                  </label>
                  <select
                    id={recurrenceInputId}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-ink-100"
                    value={recurrence}
                    onChange={(event) => {
                      const selectedValue = event.target.value;
                      if (isAutomationRecurrence(selectedValue)) {
                        setRecurrence(selectedValue);
                      }
                    }}
                  >
                    {automationRecurrenceOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
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
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-ink-100"
                    value={runTime}
                    onChange={(event) => setRunTime(event.target.value)}
                  />
                </div>
              </div>
              {error ? <p className="text-xs text-rose-300">{error}</p> : null}
              <div className="flex justify-end gap-2 text-xs">
                <button
                  className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
                  onClick={handleClose}
                >
                  Cancel
                </button>
                <button
                  className="rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-ink-50 hover:bg-flare-400/20"
                  onClick={handleCreate}
                >
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
