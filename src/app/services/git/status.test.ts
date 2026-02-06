import { describe, expect, it } from "vitest";

import { parseGitStatusOutput } from "@/app/services/git/status";

describe("parseGitStatusOutput", () => {
  it("parses branch/ahead/behind and staged/unstaged paths", () => {
    const output = [
      "## feature/refactor...origin/feature/refactor [ahead 2, behind 1]",
      "M  src/staged-only.ts",
      " M src/unstaged-only.ts",
      "MM src/both.ts",
      "R  src/old-name.ts -> src/new-name.ts",
      "?? src/untracked.ts",
    ].join("\n");

    expect(parseGitStatusOutput(output)).toEqual({
      branch: "feature/refactor",
      ahead: 2,
      behind: 1,
      stagedPaths: ["src/staged-only.ts", "src/both.ts", "src/new-name.ts"],
      unstagedPaths: [
        "src/unstaged-only.ts",
        "src/both.ts",
        "src/untracked.ts",
      ],
    });
  });
});
