import type { Project, ThreadDetail, ThreadSummary } from "@/app/types";

export const mockThreads: ThreadSummary[] = [
  {
    id: "thread-032",
    title: "Polish app for launch prep",
    subtitle: "Add drag and drop to gallery photobooth",
    status: "needs_review",
    projectId: "project-photobooth",
    lastUpdated: "1d",
    changeSummary: {
      additions: 156,
      deletions: 64,
    },
    modelProvider: "openai",
    source: "cli",
  },
  {
    id: "thread-029",
    title: "Create new app",
    subtitle: "Localize iOS app",
    status: "running",
    projectId: "project-desktop",
    lastUpdated: "4d",
    modelProvider: "openai",
    source: "app-server",
  },
];

export const mockProjects: Project[] = [
  {
    id: "project-photobooth",
    name: "photobooth",
    path: "C:/Repos/photobooth",
    tags: ["nextjs", "ui", "active"],
    activeRuns: [
      {
        id: "run-841",
        title: "Launch polish",
        status: "needs_review",
        statusLabel: "Needs review",
        threadId: "thread-032",
        projectId: "project-photobooth",
      },
    ],
    recentThreads: mockThreads,
    lastThreadId: "thread-032",
  },
  {
    id: "project-desktop",
    name: "Desktop",
    path: "C:/Repos/desktop",
    tags: ["tauri", "react"],
    activeRuns: [
      {
        id: "run-910",
        title: "Navigation refresh",
        status: "running",
        statusLabel: "Running",
        threadId: "thread-029",
        projectId: "project-desktop",
      },
    ],
    recentThreads: mockThreads,
    lastThreadId: "thread-029",
  },
];

export const mockThreadDetail: ThreadDetail = {
  id: "thread-032",
  title: "Polish app for launch prep",
  subtitle: "photobooth",
  status: "needs_review",
  projectId: "project-photobooth",
  lastUpdated: "1 day ago",
  mode: "worktree",
  worktreeStrategy: "clone",
  effort: "high",
  events: [
    {
      id: "evt-1",
      timestamp: "10:02",
      label: "Edited SnapButton.tsx",
      detail: "+17 -19",
      status: "running",
    },
    {
      id: "evt-2",
      timestamp: "10:04",
      label: "Edited PhotoStrip.tsx",
      detail: "+22 -2",
      status: "running",
    },
    {
      id: "evt-3",
      timestamp: "10:12",
      label: "Edited PreviewPolaroid.tsx",
      detail: "+5 -2",
      status: "needs_review",
    },
    {
      id: "evt-4",
      timestamp: "10:18",
      label: "Ran git status -sb",
      detail: "Explored 1 list",
      status: "queued",
    },
  ],
  attachments: [
    {
      id: "att-1",
      kind: "image",
      name: "booth-ui.png",
      path: "C:/Users/gamer/Documents/attachments/booth-ui.png",
    },
  ],
  diffSummary: {
    filesChanged: 9,
    additions: 63,
    deletions: 32,
    files: [
      {
        path: "app/api/generate/route.ts",
        additions: 1,
        deletions: 1,
        status: "modified",
      },
      {
        path: "app/components/BackgroundEffects.tsx",
        additions: 12,
        deletions: 0,
        status: "modified",
      },
      {
        path: "app/components/BoothTopPanel.tsx",
        additions: 35,
        deletions: 0,
        status: "modified",
      },
    ],
  },
  diffText: `diff --git a/app/api/generate/route.ts b/app/api/generate/route.ts
index 38bb11f..7a31822 100644
--- a/app/api/generate/route.ts
+++ b/app/api/generate/route.ts
@@ -101,7 +101,7 @@ const captionPromise = client.responses
-      model: "gpt-4.1-nano",
+      model: "gpt-5.2",
       instructions:
         "Write a short polaroid caption as if someone labeled it with a sharpie.",
       input: prompt,
`,
};
