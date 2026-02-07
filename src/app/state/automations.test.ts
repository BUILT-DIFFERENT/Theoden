import { beforeEach, describe, expect, it } from "vitest";

import {
  computeNextRunAt,
  formatAutomationSchedule,
  loadStoredAutomations,
  recurrenceFromRrule,
  recurrenceToRrule,
  storeAutomations,
  type AutomationItem,
  type AutomationRecurrence,
} from "@/app/state/automations";

function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => (store.has(key) ? (store.get(key) ?? null) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

describe("automations state helpers", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createLocalStorageMock(),
    });
  });

  it("migrates legacy localStorage automation records", () => {
    const createdAt = new Date("2026-02-07T07:45:00Z").getTime();
    window.localStorage.setItem(
      "theoden.automations",
      JSON.stringify([
        {
          id: "legacy-1",
          name: "Legacy triage",
          workspacePath: "C:/repo/theoden",
          prompt: "triage issues",
          recurrence: "Weekly",
          runTime: "11:30",
          createdAt,
          enabled: true,
        },
      ]),
    );

    const loaded = loadStoredAutomations();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({
      id: "legacy-1",
      name: "Legacy triage",
      workspacePath: "C:/repo/theoden",
      enabled: true,
      recurrence: {
        kind: "weekly",
        time: "11:30",
      },
      lastRunAt: null,
    });
    expect(typeof loaded[0].nextRunAt).toBe("number");
    expect(window.localStorage.getItem("codex.automations")).not.toBeNull();
  });

  it("round-trips recurrence rules used by automations", () => {
    const weekly: AutomationRecurrence = {
      kind: "weekly",
      time: "16:05",
      timezone: "UTC",
      dayOfWeek: 5,
      dayOfMonth: null,
    };
    const daily: AutomationRecurrence = {
      kind: "daily",
      time: "09:00",
      timezone: "UTC",
      dayOfWeek: null,
      dayOfMonth: null,
    };
    const monthly: AutomationRecurrence = {
      kind: "monthly",
      time: "08:15",
      timezone: "UTC",
      dayOfWeek: null,
      dayOfMonth: 1,
    };

    expect(recurrenceToRrule(weekly)).toBe(
      "FREQ=WEEKLY;BYDAY=FR;BYHOUR=16;BYMINUTE=5",
    );
    expect(recurrenceToRrule(daily)).toBe(
      "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU;BYHOUR=9;BYMINUTE=0",
    );
    expect(recurrenceToRrule(monthly)).toBe("FREQ=HOURLY;INTERVAL=720");

    expect(recurrenceFromRrule(recurrenceToRrule(weekly), "UTC")).toEqual({
      kind: "weekly",
      time: "16:05",
      timezone: "UTC",
      dayOfWeek: 5,
      dayOfMonth: null,
    });
    expect(recurrenceFromRrule(recurrenceToRrule(monthly), "UTC")).toEqual({
      kind: "monthly",
      time: "09:00",
      timezone: "UTC",
      dayOfWeek: null,
      dayOfMonth: 1,
    });
  });

  it("computes next-run timestamps and stores valid automation snapshots", () => {
    const from = new Date("2026-02-07T12:00:00Z").getTime();
    const daily = computeNextRunAt(
      {
        kind: "daily",
        time: "09:00",
        timezone: "UTC",
        dayOfWeek: null,
        dayOfMonth: null,
      },
      from,
    );
    const weekly = computeNextRunAt(
      {
        kind: "weekly",
        time: "10:00",
        timezone: "UTC",
        dayOfWeek: 1,
        dayOfMonth: null,
      },
      from,
    );
    const monthly = computeNextRunAt(
      {
        kind: "monthly",
        time: "08:00",
        timezone: "UTC",
        dayOfWeek: null,
        dayOfMonth: 31,
      },
      from,
    );

    expect(daily).toBeGreaterThan(from);
    expect(weekly).toBeGreaterThan(from);
    expect(monthly).toBeGreaterThan(from);

    const automationItem: AutomationItem = {
      id: "auto-1",
      name: "Morning checks",
      workspacePath: "C:/repo/theoden",
      prompt: "Run checks",
      recurrence: {
        kind: "daily",
        time: "09:00",
        timezone: "UTC",
        dayOfWeek: null,
        dayOfMonth: null,
      },
      createdAt: from,
      enabled: true,
      lastRunAt: null,
      nextRunAt: daily,
    };
    storeAutomations([automationItem]);
    expect(loadStoredAutomations()).toEqual([automationItem]);
    expect(formatAutomationSchedule(automationItem.recurrence)).toBe(
      "Daily at 09:00",
    );
  });
});
