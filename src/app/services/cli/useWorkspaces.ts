import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { listWorkspaces } from "@/app/services/cli/workspaces";
import { loadStoredWorkspaces } from "@/app/state/workspaces";
import type { WorkspaceSummary } from "@/app/types";
import { isTauri } from "@/app/utils/tauri";
import {
  normalizeWorkspacePath,
  workspaceNameFromPath,
} from "@/app/utils/workspace";

function dedupeWorkspaces(entries: WorkspaceSummary[]) {
  const map = new Map<string, WorkspaceSummary>();
  entries.forEach((entry) => {
    const key = normalizeWorkspacePath(entry.path).toLowerCase();
    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        ...existing,
        trustLevel: entry.trustLevel ?? existing.trustLevel,
        source:
          existing.source === "config" || entry.source === "config"
            ? "config"
            : existing.source,
      });
      return;
    }
    map.set(key, entry);
  });
  return Array.from(map.values());
}

export function useWorkspaces() {
  const isDesktop = isTauri();
  const query = useQuery({
    queryKey: ["workspaces"],
    queryFn: listWorkspaces,
    enabled: isDesktop,
    refetchOnWindowFocus: isDesktop,
    refetchInterval: isDesktop ? 20000 : false,
  });

  const workspaces = useMemo(() => {
    const stored = loadStoredWorkspaces().map<WorkspaceSummary>((path) => ({
      id: path,
      name: workspaceNameFromPath(path),
      path,
      source: "local",
    }));
    const configEntries = (query.data ?? []).map<WorkspaceSummary>((entry) => ({
      id: entry.path,
      name: workspaceNameFromPath(entry.path),
      path: entry.path,
      trustLevel: entry.trustLevel,
      source: "config",
    }));
    return dedupeWorkspaces([...configEntries, ...stored]).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [query.data]);

  return {
    workspaces,
    isLoading: isDesktop ? query.isPending : false,
    error: query.error,
    refresh: query.refetch,
  };
}
