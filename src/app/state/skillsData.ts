import type { RemoteSkillSummary, SkillSummary } from "@/app/types";

export const mockInstalledSkills: SkillSummary[] = [
  {
    id: "skill-yeet",
    name: "Yeet",
    description: "Stage, commit, push, and open a GitHub PR end-to-end.",
    documentation:
      "Use this skill when you need a complete git-to-PR workflow in one run.\n\nTypical flow:\n- Review local changes and stage relevant files.\n- Create a focused commit message.\n- Push the branch and open a pull request with a clear summary.",
    installed: true,
    version: "1.2.0",
    source: "Community",
    permissions: ["git", "network"],
  },
];

export const mockRemoteSkills: RemoteSkillSummary[] = [
  {
    id: "remote-skill-ci",
    name: "CI Triage",
    description: "Summarize recent CI failures and propose fixes.",
    documentation:
      "Analyzes failing checks, groups failures by root cause, and proposes the smallest fix set.\n\nInputs:\n- Latest CI logs\n- Recent commits touching failing paths\n- Test ownership metadata",
    version: "0.9.0",
    source: "Team",
    publisher: "OpenAI Labs",
    tags: ["automation", "testing"],
    installable: true,
  },
  {
    id: "remote-skill-changelog",
    name: "Changelog Draft",
    description: "Draft a changelog from merged PRs.",
    documentation:
      "Builds release notes from merged pull requests and commit metadata.\n\nOutputs:\n- Grouped highlights by feature area\n- Breaking change callouts\n- Contributor summary",
    version: "1.0.3",
    source: "Community",
    publisher: "Community",
    tags: ["docs", "release"],
    installable: true,
  },
];
