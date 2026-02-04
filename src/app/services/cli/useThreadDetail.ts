import { useQuery } from "@tanstack/react-query";
import { readThread } from "@/app/services/cli/threads";
import { isTauri } from "@/app/utils/tauri";
import { mockThreadDetail } from "@/app/state/mockData";
import type { ThreadDetail } from "@/app/types";

export function useThreadDetail(threadId: string | undefined) {
  const query = useQuery({
    queryKey: ["threads", "read", threadId],
    queryFn: () => readThread(threadId ?? "", true),
    enabled: isTauri() && Boolean(threadId)
  });

  if (!isTauri() || !threadId) {
    return { thread: mockThreadDetail, isLoading: false };
  }

  const thread = query.data
    ? ({
        id: query.data.id,
        title: query.data.preview?.trim() || "Untitled thread",
        subtitle: query.data.cwd,
        status: "done",
        projectId: query.data.cwd,
        lastUpdated: "",
        mode: "local",
        effort: "medium",
        events: [],
        attachments: [],
        diffSummary: {
          filesChanged: 0,
          additions: 0,
          deletions: 0,
          files: []
        }
      } satisfies ThreadDetail)
    : undefined;

  return { thread, isLoading: query.isLoading };
}
