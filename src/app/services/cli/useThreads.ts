import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import {
  listThreads,
  type ThreadListResponse,
} from "@/app/services/cli/threads";
import { mockProjects, mockThreads } from "@/app/state/mockData";
import {
  loadCachedThreadSummaries,
  storeCachedThreadSummaries,
} from "@/app/state/threadCache";
import type { Project, ThreadSummary } from "@/app/types";
import { isTauri } from "@/app/utils/tauri";
import { formatRelativeTimeFromSeconds } from "@/app/utils/time";
import { normalizeWorkspacePath } from "@/app/utils/workspace";

function projectKeyFromCwd(cwd: string) {
  return cwd.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

function projectNameFromCwd(cwd: string) {
  const parts = cwd.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? cwd;
}

function mapThreadToSummary(
  thread: {
    id: string;
    preview: string;
    cwd: string;
    updatedAt: number;
    modelProvider?: string;
    source?: unknown;
  },
  archived = false,
) {
  const title = thread.preview?.trim().length
    ? thread.preview
    : "Untitled thread";
  return {
    id: thread.id,
    title,
    subtitle: thread.cwd,
    status: "done",
    archived,
    projectId: projectKeyFromCwd(thread.cwd),
    lastUpdated: formatRelativeTimeFromSeconds(thread.updatedAt),
    modelProvider: thread.modelProvider,
    source: sourceLabelFromThread(thread.source),
  } satisfies ThreadSummary;
}

function mapThreadsToProjects(threads: ThreadSummary[]): Project[] {
  const grouped = new Map<string, Project>();
  threads.forEach((thread) => {
    const projectId = thread.projectId;
    const existing = grouped.get(projectId);
    if (!existing) {
      grouped.set(projectId, {
        id: projectId,
        name: projectNameFromCwd(thread.subtitle),
        path: thread.subtitle,
        tags: ["cli"],
        activeRuns: [],
        recentThreads: [thread],
        lastThreadId: thread.id,
      });
      return;
    }
    existing.recentThreads.push(thread);
  });
  return Array.from(grouped.values(), (project) => ({
    ...project,
    recentThreads: project.recentThreads,
    lastThreadId: project.recentThreads[0]?.id ?? project.lastThreadId,
  }));
}

export interface ThreadListOptions {
  search?: string;
  limit?: number;
  archived?: boolean;
  modelProviders?: string[];
  sourceKinds?: string[];
  workspacePath?: string | null;
}

function normalizeSearch(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

export function useThreadList(options: ThreadListOptions = {}) {
  const isDesktop = isTauri();
  const normalizedProviders = normalizeArray(options.modelProviders);
  const normalizedSources = normalizeArray(options.sourceKinds);
  const archived = options.archived ?? false;
  const canUsePrimaryCache =
    !archived &&
    normalizedProviders.length === 0 &&
    normalizedSources.length === 0;
  const cachedThreads = useMemo(
    () =>
      isDesktop && canUsePrimaryCache
        ? loadCachedThreadSummaries()
        : ([] as ThreadSummary[]),
    [canUsePrimaryCache, isDesktop],
  );
  const normalizedWorkspace = useMemo(() => {
    if (!options.workspacePath) return null;
    return normalizeWorkspacePath(options.workspacePath).toLowerCase();
  }, [options.workspacePath]);
  const query = useInfiniteQuery<ThreadListResponse>({
    queryKey: [
      "threads",
      "list",
      options.limit ?? 50,
      archived,
      normalizedProviders,
      normalizedSources,
    ],
    queryFn: ({ pageParam }) =>
      listThreads({
        cursor: typeof pageParam === "string" ? pageParam : null,
        limit: options.limit ?? 50,
        archived: options.archived ?? undefined,
        modelProviders: normalizedProviders,
        sourceKinds: normalizedSources,
      }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isDesktop,
    refetchOnWindowFocus: isDesktop,
    refetchInterval: isDesktop ? 15000 : false,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!isDesktop) {
      return;
    }
    if (query.isPending || query.isFetchingNextPage || !query.hasNextPage) {
      return;
    }
    void query.fetchNextPage();
  }, [
    isDesktop,
    query.fetchNextPage,
    query.hasNextPage,
    query.isFetchingNextPage,
    query.isPending,
  ]);
  const remoteThreads = useMemo(() => {
    const pages = query.data?.pages ?? [];
    return pages
      .flatMap((page) => page.data)
      .map((thread) => mapThreadToSummary(thread, archived));
  }, [archived, query.data]);

  useEffect(() => {
    if (!isDesktop || !canUsePrimaryCache || !query.data) {
      return;
    }
    storeCachedThreadSummaries(remoteThreads);
  }, [canUsePrimaryCache, isDesktop, query.data, remoteThreads]);

  const allThreads = useMemo(() => {
    if (!isDesktop) return mockThreads;
    if (query.data) {
      return remoteThreads;
    }
    if (cachedThreads.length) {
      return cachedThreads;
    }
    return [];
  }, [cachedThreads, isDesktop, mockThreads, query.data, remoteThreads]);
  const workspaceThreads = useMemo(() => {
    if (!normalizedWorkspace) return allThreads;
    return allThreads.filter((thread) => {
      const normalizedCwd = normalizeWorkspacePath(
        thread.subtitle,
      ).toLowerCase();
      return normalizedCwd === normalizedWorkspace;
    });
  }, [allThreads, normalizedWorkspace]);
  const search = normalizeSearch(options.search);
  const threads = useMemo(() => {
    if (!search) return workspaceThreads;
    return workspaceThreads.filter((thread) => {
      const haystack =
        `${thread.title} ${thread.subtitle} ${thread.projectId}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [search, workspaceThreads]);
  const providers = useMemo(
    () =>
      Array.from(
        new Set(
          workspaceThreads
            .map((thread) => thread.modelProvider)
            .filter((provider): provider is string => Boolean(provider)),
        ),
      ).sort(),
    [workspaceThreads],
  );
  const sources = useMemo(
    () =>
      Array.from(
        new Set(
          workspaceThreads
            .map((thread) => thread.source)
            .filter((source): source is string => Boolean(source)),
        ),
      ).sort(),
    [workspaceThreads],
  );
  const projects = useMemo(
    () => (isDesktop ? mapThreadsToProjects(workspaceThreads) : mockProjects),
    [isDesktop, mockProjects, workspaceThreads],
  );
  const isMockData = !isDesktop;
  return {
    threads,
    allThreads,
    projects,
    providers,
    sources,
    hasMore: isDesktop ? query.hasNextPage : false,
    loadMore: query.fetchNextPage,
    isFetchingMore: isDesktop ? query.isFetchingNextPage : false,
    isLoading: isDesktop ? query.isPending : false,
    isMock: isMockData,
  };
}

function normalizeArray(values?: string[]) {
  if (!values?.length) return [];
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  ).sort();
}

function sourceLabelFromThread(source?: unknown) {
  if (typeof source === "string") return source;
  if (source && typeof source === "object" && "subagent" in source) {
    return "subagent";
  }
  return undefined;
}
