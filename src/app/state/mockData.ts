import type { Project, ThreadDetail, ThreadSummary } from "@/app/types";

export const mockThreads: ThreadSummary[] = [
  {
    id: "thread-032",
    title: "Fix timestamp bug in invoice export",
    subtitle: "Scanned 84 files · 3 edits · tests pending",
    status: "needs_review",
    projectId: "project-northstar",
    lastUpdated: "2 minutes ago",
    modelProvider: "openai",
    source: "cli",
  },
  {
    id: "thread-029",
    title: "Add automation for CI failure triage",
    subtitle: "Drafted automation template",
    status: "running",
    projectId: "project-aurora",
    lastUpdated: "5 minutes ago",
    modelProvider: "openai",
    source: "app-server",
  },
];

export const mockProjects: Project[] = [
  {
    id: "project-northstar",
    name: "Northstar Desktop",
    path: "C:/Repos/northstar",
    tags: ["tauri", "react", "active"],
    activeRuns: [
      {
        id: "run-841",
        title: "Timestamp hotfix",
        status: "needs_review",
        statusLabel: "Needs review",
        threadId: "thread-032",
        projectId: "project-northstar",
      },
    ],
    recentThreads: mockThreads,
    lastThreadId: "thread-032",
  },
  {
    id: "project-aurora",
    name: "Aurora API",
    path: "C:/Repos/aurora",
    tags: ["rust", "automation"],
    activeRuns: [
      {
        id: "run-910",
        title: "CI failures triage",
        status: "running",
        statusLabel: "Running",
        threadId: "thread-029",
        projectId: "project-aurora",
      },
    ],
    recentThreads: mockThreads,
    lastThreadId: "thread-029",
  },
];

export const mockThreadDetail: ThreadDetail = {
  id: "thread-032",
  title: "Fix timestamp bug in invoice export",
  subtitle: "Worktree mode · Scanned 84 files · 3 edits",
  status: "needs_review",
  projectId: "project-northstar",
  lastUpdated: "2 minutes ago",
  mode: "worktree",
  worktreeStrategy: "clone",
  effort: "high",
  events: [
    {
      id: "evt-1",
      timestamp: "10:02",
      label: "Planning",
      detail: "Outlined bug triage plan",
      status: "running",
    },
    {
      id: "evt-2",
      timestamp: "10:04",
      label: "Searched 84 files",
      detail: "Focused on invoice export pipeline",
      status: "running",
    },
    {
      id: "evt-3",
      timestamp: "10:12",
      label: "Edited 3 files",
      detail: "Updated ISO8601 parsing",
      status: "needs_review",
    },
    {
      id: "evt-4",
      timestamp: "10:18",
      label: "Tests pending",
      detail: "Awaiting user review",
      status: "queued",
    },
  ],
  attachments: [
    {
      id: "att-1",
      kind: "image",
      name: "export-bug.png",
      path: "C:/Users/gamer/Documents/attachments/export-bug.png",
    },
  ],
  diffSummary: {
    filesChanged: 3,
    additions: 42,
    deletions: 17,
    files: [
      {
        path: "src/export/serializer.ts",
        additions: 18,
        deletions: 3,
        status: "modified",
      },
      {
        path: "src/export/timezone.ts",
        additions: 12,
        deletions: 9,
        status: "modified",
      },
      {
        path: "src/export/iso.ts",
        additions: 12,
        deletions: 5,
        status: "modified",
      },
    ],
  },
  diffText: `diff --git a/src/export/serializer.ts b/src/export/serializer.ts
index 1c2d3e4..5f6a7b8 100644
--- a/src/export/serializer.ts
+++ b/src/export/serializer.ts
@@ -44,7 +44,9 @@ export function serializeInvoice() {
-  return formatTimestamp(record.timestamp);
+  return formatTimestamp(record.timestamp, {
+    allowTimezoneOffset: true,
+  });
}
`,
};
