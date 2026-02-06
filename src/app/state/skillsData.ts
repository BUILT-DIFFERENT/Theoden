import type { RemoteSkillSummary, SkillSummary } from "@/app/types";

export const mockInstalledSkills: SkillSummary[] = [
  {
    id: "skill-yeet",
    name: "Yeet",
    description: "Stage, commit, push, and open a GitHub PR end-to-end.",
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
    version: "1.0.3",
    source: "Community",
    publisher: "Community",
    tags: ["docs", "release"],
    installable: true,
  },
];
