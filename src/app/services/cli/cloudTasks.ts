import { runCli } from "@/app/services/cli/runner";
import type { CloudTaskSummary } from "@/app/types";
import { formatRelativeTimeFromSeconds } from "@/app/utils/time";

interface CloudTaskListPayload {
  tasks?: Array<Record<string, unknown>>;
  cursor?: string | null;
}

function mapStatus(raw?: unknown): CloudTaskSummary["status"] {
  if (typeof raw !== "string") return "running";
  switch (raw) {
    case "pending":
      return "queued";
    case "ready":
    case "applied":
      return "completed";
    case "error":
      return "failed";
    default:
      return "running";
  }
}

function formatUpdatedAt(value?: unknown) {
  if (typeof value === "number") {
    return formatRelativeTimeFromSeconds(value);
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return formatRelativeTimeFromSeconds(Math.floor(parsed / 1000));
    }
    return value;
  }
  return "recently";
}

function toIdString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

export async function listCloudTasks(
  params: {
    limit?: number;
    cursor?: string | null;
    environment?: string;
  } = {},
): Promise<{ tasks: CloudTaskSummary[]; cursor: string | null }> {
  const args = ["cloud", "list", "--json"];
  if (params.environment) {
    args.push("--env", params.environment);
  }
  if (params.limit) {
    args.push("--limit", String(params.limit));
  }
  if (params.cursor) {
    args.push("--cursor", params.cursor);
  }
  const result = await runCli({ args });
  if (result.code !== 0) {
    throw new Error(result.stderr || "Failed to list cloud tasks.");
  }
  const raw = result.stdout.trim();
  if (!raw) {
    return { tasks: [], cursor: null };
  }
  let payload: CloudTaskListPayload;
  try {
    payload = JSON.parse(raw) as CloudTaskListPayload;
  } catch {
    throw new Error("Cloud tasks output was not valid JSON.");
  }
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  return {
    tasks: tasks.map((task) => ({
      id: toIdString(task.id),
      title: typeof task.title === "string" ? task.title : undefined,
      url: typeof task.url === "string" ? task.url : undefined,
      environment:
        typeof task.environment_label === "string"
          ? task.environment_label
          : typeof task.environment_id === "string"
            ? task.environment_id
            : "Cloud",
      status: mapStatus(task.status),
      updatedAt: formatUpdatedAt(task.updated_at),
      filesChanged:
        typeof task.summary === "object" && task.summary
          ? Number((task.summary as Record<string, unknown>).files_changed ?? 0)
          : undefined,
      linesAdded:
        typeof task.summary === "object" && task.summary
          ? Number((task.summary as Record<string, unknown>).lines_added ?? 0)
          : undefined,
      linesRemoved:
        typeof task.summary === "object" && task.summary
          ? Number((task.summary as Record<string, unknown>).lines_removed ?? 0)
          : undefined,
      isReview: Boolean(task.is_review),
      attemptTotal:
        typeof task.attempt_total === "number" ? task.attempt_total : undefined,
    })),
    cursor: payload.cursor ?? null,
  };
}
