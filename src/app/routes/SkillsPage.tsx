import { useMemo, useState } from "react";

import { mockInstalledSkills, mockRemoteSkills } from "@/app/state/skillsData";
import type { RemoteSkillSummary, SkillSummary } from "@/app/types";

export function SkillsPage() {
  const [search, setSearch] = useState("");
  const [newSkillOpen, setNewSkillOpen] = useState(false);
  const [detailSkill, setDetailSkill] = useState<
    SkillSummary | RemoteSkillSummary | null
  >(null);
  const [skillName, setSkillName] = useState("");
  const [skillDescription, setSkillDescription] = useState("");
  const [skillError, setSkillError] = useState<string | null>(null);
  const skillNameInputId = "new-skill-name";
  const skillDescriptionInputId = "new-skill-description";

  const normalizedSearch = search.trim().toLowerCase();
  const installedSkills = useMemo(() => {
    if (!normalizedSearch) return mockInstalledSkills;
    return mockInstalledSkills.filter((skill) => {
      const haystack = `${skill.name} ${skill.description}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [normalizedSearch]);
  const remoteSkills = useMemo(() => {
    if (!normalizedSearch) return mockRemoteSkills;
    return mockRemoteSkills.filter((skill) => {
      const haystack =
        `${skill.name} ${skill.description} ${skill.publisher}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [normalizedSearch]);

  const handleCreateSkill = () => {
    if (!skillName.trim()) {
      setSkillError("Name is required.");
      return;
    }
    console.warn("Create skill", { skillName, skillDescription });
    setSkillName("");
    setSkillDescription("");
    setSkillError(null);
    setNewSkillOpen(false);
  };

  const handleCloseNewSkill = () => {
    setNewSkillOpen(false);
    setSkillError(null);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Skills
            </p>
            <h2 className="font-display text-xl">Skills</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search skills"
              className="w-56 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 focus:border-flare-300 focus:outline-none"
            />
            <button
              className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
              onClick={() => setNewSkillOpen(true)}
            >
              + New skill
            </button>
            <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Installed
            </p>
            <h2 className="font-display text-xl">Skills in your workspace</h2>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {installedSkills.map((skill) => (
            <div
              key={skill.id}
              className="rounded-xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink-100">{skill.name}</p>
                <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-ink-300">
                  Installed
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-400">{skill.description}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-300">
                {skill.permissions.map((perm) => (
                  <span
                    key={perm}
                    className="rounded-full border border-white/10 px-2 py-0.5"
                  >
                    {perm}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <button
                  className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
                  onClick={() => setDetailSkill(skill)}
                >
                  View details
                </button>
              </div>
            </div>
          ))}
          {!installedSkills.length ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-ink-400">
              No skills match your search.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Recommended
            </p>
            <h2 className="font-display text-xl">Skill catalog</h2>
          </div>
          <span className="text-xs text-ink-400">
            {remoteSkills.length} available
          </span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {remoteSkills.map((skill) => (
            <div
              key={skill.id}
              className="rounded-xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink-100">{skill.name}</p>
                <span className="text-xs text-ink-400">{skill.publisher}</span>
              </div>
              <p className="mt-1 text-xs text-ink-400">{skill.description}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-300">
                {skill.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 px-2 py-0.5"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <button
                  className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
                  onClick={() => setDetailSkill(skill)}
                >
                  View details
                </button>
                <button className="rounded-full border border-flare-300 bg-flare-400/20 px-3 py-1 text-ink-50 shadow-glow">
                  Download
                </button>
              </div>
            </div>
          ))}
          {!remoteSkills.length ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-ink-400">
              No recommended skills match your search.
            </div>
          ) : null}
        </div>
      </section>

      {newSkillOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-ink-900/95 p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-ink-50">New skill</h3>
              <button
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-ink-300 hover:border-flare-300"
                onClick={handleCloseNewSkill}
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-ink-300">
              <div className="space-y-2">
                <label
                  className="text-xs uppercase tracking-[0.2em] text-ink-500"
                  htmlFor={skillNameInputId}
                >
                  Name
                </label>
                <input
                  id={skillNameInputId}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-ink-100"
                  placeholder="Repo triage"
                  value={skillName}
                  onChange={(event) => setSkillName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-xs uppercase tracking-[0.2em] text-ink-500"
                  htmlFor={skillDescriptionInputId}
                >
                  Description
                </label>
                <textarea
                  id={skillDescriptionInputId}
                  className="h-24 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-ink-100"
                  placeholder="Describe what this skill does."
                  value={skillDescription}
                  onChange={(event) => setSkillDescription(event.target.value)}
                />
              </div>
              {skillError ? (
                <p className="text-xs text-rose-300">{skillError}</p>
              ) : null}
              <div className="flex justify-end gap-2 text-xs">
                <button
                  className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
                  onClick={handleCloseNewSkill}
                >
                  Cancel
                </button>
                <button
                  className="rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-ink-50 hover:bg-flare-400/20"
                  onClick={handleCreateSkill}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {detailSkill ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-ink-900/95 p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-ink-50">
                {detailSkill.name}
              </h3>
              <button
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-ink-300 hover:border-flare-300"
                onClick={() => setDetailSkill(null)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-ink-300">
              <p>{detailSkill.description}</p>
              {"publisher" in detailSkill ? (
                <p className="text-xs text-ink-400">
                  Publisher: {detailSkill.publisher}
                </p>
              ) : null}
              {"permissions" in detailSkill ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  {detailSkill.permissions.map((perm) => (
                    <span
                      key={perm}
                      className="rounded-full border border-white/10 px-2 py-0.5"
                    >
                      {perm}
                    </span>
                  ))}
                </div>
              ) : null}
              {"tags" in detailSkill ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  {detailSkill.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/10 px-2 py-0.5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="flex justify-end gap-2 text-xs">
                <button
                  className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
                  onClick={() => setDetailSkill(null)}
                >
                  Close
                </button>
                {"installed" in detailSkill ? (
                  <button className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300">
                    Open
                  </button>
                ) : (
                  <button className="rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-ink-50 hover:bg-flare-400/20">
                    Try
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
