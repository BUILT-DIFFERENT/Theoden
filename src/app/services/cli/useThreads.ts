import { useQuery } from "@tanstack/react-query";
import type { Project, ThreadSummary } from "@/app/types";
import { listThreads } from "@/app/services/cli/threads";
import { isTauri } from "@/app/utils/tauri";
import { formatRelativeTimeFromSeconds } from "@/app/utils/time";
import { mockProjects, mockThreads } from "@/app/state/mockData";

function projectKeyFromCwd(cwd: string) {
  return cwd.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

function projectNameFromCwd(cwd: string) {
  const parts = cwd.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? cwd;
}

function mapThreadToSummary(thread: {
  id: string;
  preview: string;
  cwd: string;
  updatedAt: number;
}) {
  const title = thread.preview?.trim().length ? thread.preview : "Untitled thread";
  return {
    id: thread.id,
    title,
    subtitle: thread.cwd,
    status: "done",
    projectId: projectKeyFromCwd(thread.cwd),
    lastUpdated: formatRelativeTimeFromSeconds(thread.updatedAt)
  } satisfies ThreadSummary;
}

function mapThreadsToProjects(threads: ThreadSummary[]): Project[] {
  const grouped: Record<string, Project> = {};
  threads.forEach((thread) => {
    const projectId = thread.projectId;
    if (!grouped[projectId]) {
      grouped[projectId] = {
        id: projectId,
        name: projectNameFromCwd(thread.subtitle),
        path: thread.subtitle,
        tags: ["cli"],
        activeRuns: [],
        recentThreads: [],
        lastThreadId: thread.id
      };
    }
    grouped[projectId].recentThreads.push(thread);
  });
  return Object.values(grouped).map((project) => ({
    ...project,
    recentThreads: project.recentThreads.slice(0, 5),
    lastThreadId: project.recentThreads[0]?.id ?? project.lastThreadId
  }));
}

export function useThreadList() {
  const query = useQuery({
    queryKey: ["threads", "list"],
    queryFn: () => listThreads({ limit: 50 }),
    enabled: isTauri()
  });

  if (!isTauri()) {
    return {
      threads: mockThreads,
      projects: mockProjects,
      isLoading: false,
      isMock: true
    };
  }

  const threads = (query.data ?? []).map(mapThreadToSummary);
  return {
    threads,
    projects: mapThreadsToProjects(threads),
    isLoading: query.isLoading,
    isMock: false
  };
}
