import { describe, expect, it } from "vitest";

import {
  diffStatsFromText,
  summarizeChanges,
  summarizeTurns,
} from "@/app/services/cli/diffSummary";

describe("diffSummary", () => {
  it("parses additions/deletions from diff text", () => {
    const diff = [
      "diff --git a/src/a.ts b/src/a.ts",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1,2 +1,3 @@",
      " line 1",
      "-line 2",
      "+line 2 updated",
      "+line 3",
    ].join("\n");
    expect(diffStatsFromText(diff)).toEqual({
      additions: 2,
      deletions: 1,
    });
  });

  it("summarizes file changes with status merge", () => {
    const summary = summarizeChanges([
      {
        path: "src/a.ts",
        diff: "+a\n-b",
        kind: { type: "modify" },
      },
      {
        path: "src/a.ts",
        diff: "+c",
        kind: { type: "delete" },
      },
      {
        path: "src/new.ts",
        diff: "+n",
        kind: { type: "add" },
      },
    ]);
    expect(summary).toEqual({
      filesChanged: 2,
      additions: 3,
      deletions: 1,
      files: [
        {
          path: "src/a.ts",
          additions: 2,
          deletions: 1,
          status: "deleted",
        },
        {
          path: "src/new.ts",
          additions: 1,
          deletions: 0,
          status: "added",
        },
      ],
    });
  });

  it("summarizes turns by reading fileChange items", () => {
    const summary = summarizeTurns([
      {
        id: "turn-1",
        items: [
          {
            type: "fileChange",
            changes: [
              {
                path: "src/main.ts",
                diff: "+const a = 1",
                kind: { type: "modify" },
              },
            ],
          },
        ],
      },
    ]);
    expect(summary).toEqual({
      filesChanged: 1,
      additions: 1,
      deletions: 0,
      files: [
        {
          path: "src/main.ts",
          additions: 1,
          deletions: 0,
          status: "modified",
        },
      ],
    });
  });
});
