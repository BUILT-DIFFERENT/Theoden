import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AutomationsPage } from "@/app/routes/AutomationsPage";

vi.mock("@/app/services/cli/useWorkspaces", () => ({
  useWorkspaces: () => ({
    workspaces: [{ path: "/repo/theoden", name: "Theoden" }],
    isLoading: false,
    error: null,
    refresh: () => Promise.resolve(),
  }),
}));

vi.mock("@/app/services/host/automations", () => ({
  listAutomations: () => Promise.resolve([]),
  listAutomationRuns: () => Promise.resolve([]),
  listInboxItems: () => Promise.resolve([]),
  createAutomation: () =>
    Promise.resolve({
      id: "automation-1",
      name: "Test automation",
      prompt: "run checks",
      status: "ACTIVE",
      nextRunAt: null,
      lastRunAt: null,
      cwds: ["/repo/theoden"],
      rrule: "FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=0",
      createdAt: 1,
      updatedAt: 1,
    }),
  updateAutomation: () => Promise.resolve(null),
  deleteAutomation: () => Promise.resolve(),
  runAutomationNow: () => Promise.resolve(null),
  subscribeAutomationStoreUpdates: () => Promise.resolve(() => {}),
  markInboxRead: () => Promise.resolve(),
}));

vi.mock("@/app/utils/tauri", () => ({
  isTauri: () => false,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AutomationsPage />
    </QueryClientProvider>,
  );
}

describe("AutomationsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the automation safety warning in the create sheet", async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "+ Create automation" }),
    );

    expect(
      await screen.findByText(
        "Automations can run commands unattended in your projects.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the create sheet when clicking the backdrop", async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "+ Create automation" }),
    );

    const dialog = await screen.findByRole("dialog");
    const backdrop = dialog.parentElement;
    if (!backdrop) {
      throw new Error("Expected backdrop wrapper to exist");
    }

    fireEvent.click(
      within(backdrop).getByRole("button", {
        name: "Close create automation sheet",
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
