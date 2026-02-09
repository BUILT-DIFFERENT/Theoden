import { listThreads } from "@/app/services/cli/threads";
import { resumeThread as resumeThreadSession } from "@/app/services/cli/turns";

export interface ThreadRecord {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  projectPath: string;
}

export async function listThreadHistory(): Promise<ThreadRecord[]> {
  const result = await listThreads({
    limit: 100,
    sortKey: "updated_at",
  });
  return result.data.map((thread) => ({
    id: thread.id,
    title: thread.preview?.trim() || "Untitled thread",
    status: "done",
    createdAt: String(thread.createdAt),
    projectPath: thread.cwd,
  }));
}

export async function resumeThread(threadId: string): Promise<void> {
  if (!threadId.trim()) {
    throw new Error("threadId is required.");
  }
  await resumeThreadSession({ threadId: threadId.trim() });
}
