import type { RemoteSkillSummary, SkillSummary } from "@/app/types";

export const mockInstalledSkills: SkillSummary[] = [
  {
    id: "skill-yeet",
    name: "Yeet",
    description: "Stage, commit, push, and open a GitHub PR end-to-end.",
    installed: true,
    permissions: ["git", "network"]
  }
];

export const mockRemoteSkills: RemoteSkillSummary[] = [
  {
    id: "remote-skill-ci",
    name: "CI Triage",
    description: "Summarize recent CI failures and propose fixes.",
    publisher: "OpenAI Labs",
    tags: ["automation", "testing"],
    installable: true
  },
  {
    id: "remote-skill-changelog",
    name: "Changelog Draft",
    description: "Draft a changelog from merged PRs.",
    publisher: "Community",
    tags: ["docs", "release"],
    installable: true
  }
];
