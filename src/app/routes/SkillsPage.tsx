import { useNavigate } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAppUi } from "@/app/state/appUi";
import { mockInstalledSkills, mockRemoteSkills } from "@/app/state/skillsData";
import type { RemoteSkillSummary, SkillSummary } from "@/app/types";

const SKILLS_STORAGE_KEY = "codex.skills.installed";
const LEGACY_SKILLS_STORAGE_KEY = "theoden.skills.installed";

function loadStoredInstalledSkillIds() {
  const fallback = new Set(mockInstalledSkills.map((skill) => skill.id));
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw =
      window.localStorage.getItem(SKILLS_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_SKILLS_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return fallback;
    }
    const installedSkillIds = new Set([
      ...fallback,
      ...parsed.filter((value): value is string => typeof value === "string"),
    ]);
    if (!window.localStorage.getItem(SKILLS_STORAGE_KEY)) {
      window.localStorage.setItem(
        SKILLS_STORAGE_KEY,
        JSON.stringify(Array.from(installedSkillIds.values()).sort()),
      );
    }
    return installedSkillIds;
  } catch {
    return fallback;
  }
}

function storeInstalledSkillIds(ids: Set<string>) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const serializableIds = Array.from(ids.values()).sort();
    window.localStorage.setItem(
      SKILLS_STORAGE_KEY,
      JSON.stringify(serializableIds),
    );
  } catch {
    // Best-effort only.
  }
}

function remoteSkillToInstalled(skill: RemoteSkillSummary): SkillSummary {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    documentation: skill.documentation,
    installed: true,
    version: skill.version,
    source: skill.source,
    permissions: skill.tags.length ? skill.tags : ["workspace"],
  };
}

function renderDocumentationBlocks(documentation: string) {
  return documentation
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      const lines = block.split(/\r?\n/).map((line) => line.trim());
      const listItems = lines
        .filter((line) => line.startsWith("- "))
        .map((line) => line.replace(/^- /, "").trim());
      if (listItems.length && listItems.length === lines.length) {
        return (
          <ul
            key={`doc-list-${index}`}
            className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-ink-200"
          >
            {listItems.map((item, itemIndex) => (
              <li key={`doc-list-${index}-item-${itemIndex}`}>{item}</li>
            ))}
          </ul>
        );
      }
      return (
        <p key={`doc-paragraph-${index}`} className="text-xs leading-relaxed">
          {block}
        </p>
      );
    });
}

export function SkillsPage() {
  const navigate = useNavigate();
  const { setComposerDraft } = useAppUi();
  const [search, setSearch] = useState("");
  const [newSkillOpen, setNewSkillOpen] = useState(false);
  const [installedSkillIds, setInstalledSkillIds] = useState<Set<string>>(() =>
    loadStoredInstalledSkillIds(),
  );
  const [customSkills, setCustomSkills] = useState<SkillSummary[]>([]);
  const [detailSkill, setDetailSkill] = useState<
    SkillSummary | RemoteSkillSummary | null
  >(null);
  const [detailMenuOpen, setDetailMenuOpen] = useState(false);
  const [detailMessage, setDetailMessage] = useState<string | null>(null);
  const [skillName, setSkillName] = useState("");
  const [skillDescription, setSkillDescription] = useState("");
  const [skillError, setSkillError] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const skillNameInputId = "new-skill-name";
  const skillDescriptionInputId = "new-skill-description";

  useEffect(() => {
    if (!refreshMessage) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setRefreshMessage(null);
    }, 2000);
    return () => window.clearTimeout(timeoutId);
  }, [refreshMessage]);

  useEffect(() => {
    storeInstalledSkillIds(installedSkillIds);
  }, [installedSkillIds]);

  const normalizedSearch = search.trim().toLowerCase();
  const installedSkills = useMemo(() => {
    const defaultInstalledSkills = mockInstalledSkills.filter((skill) =>
      installedSkillIds.has(skill.id),
    );
    const installedRemoteSkills = mockRemoteSkills
      .filter((skill) => installedSkillIds.has(skill.id))
      .filter(
        (skill) =>
          !defaultInstalledSkills.some(
            (installedSkill) => installedSkill.id === skill.id,
          ),
      )
      .map(remoteSkillToInstalled);
    const activeInstalledSkills = [
      ...defaultInstalledSkills,
      ...customSkills.filter((skill) => installedSkillIds.has(skill.id)),
      ...installedRemoteSkills,
    ];
    if (!normalizedSearch) return activeInstalledSkills;
    return activeInstalledSkills.filter((skill) => {
      const haystack = `${skill.name} ${skill.description}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [customSkills, installedSkillIds, normalizedSearch]);
  const remoteSkills = useMemo(() => {
    if (!normalizedSearch) return mockRemoteSkills;
    return mockRemoteSkills.filter((skill) => {
      const haystack =
        `${skill.name} ${skill.description} ${skill.publisher}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [normalizedSearch]);

  const handleCreateSkill = () => {
    const trimmedName = skillName.trim();
    const trimmedDescription = skillDescription.trim();
    if (!trimmedName) {
      setSkillError("Name is required.");
      return;
    }
    if (!trimmedDescription) {
      setSkillError("Description is required.");
      return;
    }
    const createdSkill: SkillSummary = {
      id: `custom-skill-${Date.now()}`,
      name: trimmedName,
      description: trimmedDescription,
      documentation: `${trimmedDescription}\n\nCreated locally from the Skills page.`,
      installed: true,
      version: "0.1.0",
      source: "Community",
      permissions: ["workspace"],
    };
    setCustomSkills((current) => [createdSkill, ...current]);
    setInstalledSkillIds((current) => {
      const next = new Set(current);
      next.add(createdSkill.id);
      return next;
    });
    setSkillName("");
    setSkillDescription("");
    setSkillError(null);
    setNewSkillOpen(false);
  };

  const handleCloseNewSkill = () => {
    setNewSkillOpen(false);
    setSkillError(null);
  };

  const handleRefresh = () => {
    setRefreshMessage("Skill catalog refreshed.");
  };

  const handleDetailOpen = (skill: SkillSummary | RemoteSkillSummary) => {
    setDetailSkill(skill);
    setDetailMenuOpen(false);
    setDetailMessage(null);
  };
  const detailInstalled = detailSkill
    ? installedSkillIds.has(detailSkill.id)
    : false;

  const handleInstallSkill = (skill: RemoteSkillSummary) => {
    if (!skill.installable) {
      setDetailMessage(`${skill.name} is not installable.`);
      return;
    }
    setInstalledSkillIds((current) => {
      if (current.has(skill.id)) {
        return current;
      }
      const next = new Set(current);
      next.add(skill.id);
      return next;
    });
    setDetailMessage(`Installed ${skill.name}.`);
  };

  const handleTrySkill = async () => {
    if (!detailSkill) return;
    const skillPrompt = `Use @${detailSkill.name} (${detailSkill.id}) to help with this task.`;
    setComposerDraft(skillPrompt);
    await navigate({ to: "/" });
    setDetailMessage(`Prepared ${detailSkill.name} in the composer.`);
  };

  const handleOpenSkill = () => {
    if (!detailSkill) return;
    if (!detailInstalled) {
      setDetailMessage("Install this skill before opening it.");
      return;
    }
    setDetailMessage(`${detailSkill.name} is ready in this workspace.`);
  };

  const handleUninstallSkill = () => {
    if (!detailSkill || !detailInstalled) return;
    setInstalledSkillIds((current) => {
      const next = new Set(current);
      next.delete(detailSkill.id);
      return next;
    });
    setDetailMessage(`Uninstalled ${detailSkill.name}.`);
  };

  const handleCopySkillId = async () => {
    if (!detailSkill) return;
    try {
      await navigator.clipboard.writeText(detailSkill.id);
      setDetailMessage("Skill ID copied.");
    } catch (error) {
      console.warn("Failed to copy skill ID", error);
      setDetailMessage("Unable to copy skill ID.");
    }
  };

  const handleOverflowAction = (action: "copy-id" | "report") => {
    setDetailMenuOpen(false);
    if (!detailSkill) return;
    if (action === "copy-id") {
      void handleCopySkillId();
      return;
    }
    setDetailMessage("Thanks, feedback captured.");
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
            <button
              className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
              onClick={handleRefresh}
            >
              Refresh
            </button>
          </div>
        </div>
        {refreshMessage ? (
          <p className="mt-3 text-xs text-emerald-300">{refreshMessage}</p>
        ) : null}
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
                  onClick={() => handleDetailOpen(skill)}
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
                  onClick={() => handleDetailOpen(skill)}
                >
                  View details
                </button>
                <button
                  className="rounded-full border border-flare-300 bg-flare-400/20 px-3 py-1 text-ink-50 shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => handleInstallSkill(skill)}
                  disabled={
                    !skill.installable || installedSkillIds.has(skill.id)
                  }
                >
                  {installedSkillIds.has(skill.id) ? "Installed" : "Download"}
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
              <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-ink-400">
                <span className="rounded-full border border-white/10 px-2 py-0.5">
                  v{detailSkill.version}
                </span>
                <span className="rounded-full border border-white/10 px-2 py-0.5">
                  {detailSkill.source}
                </span>
                {"publisher" in detailSkill ? (
                  <span className="rounded-full border border-white/10 px-2 py-0.5">
                    {detailSkill.publisher}
                  </span>
                ) : null}
              </div>
              <p>{detailSkill.description}</p>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-ink-500">
                  Documentation
                </p>
                <div className="mt-2 space-y-2 text-ink-200">
                  {renderDocumentationBlocks(detailSkill.documentation)}
                </div>
              </div>
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
              {detailMessage ? (
                <p className="text-xs text-ink-400">{detailMessage}</p>
              ) : null}
              <div className="flex justify-end gap-2 text-xs">
                <button
                  className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
                  onClick={() => {
                    void handleTrySkill();
                  }}
                >
                  Try
                </button>
                {"installable" in detailSkill && !detailInstalled ? (
                  <button
                    className="rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-ink-50 hover:bg-flare-400/20"
                    onClick={() => handleInstallSkill(detailSkill)}
                  >
                    Install
                  </button>
                ) : null}
                <button
                  className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleOpenSkill}
                  disabled={!detailInstalled}
                >
                  Open
                </button>
                {detailInstalled ? (
                  <button
                    className="rounded-full border border-rose-400/40 px-3 py-1 text-rose-200 hover:bg-rose-500/10"
                    onClick={handleUninstallSkill}
                  >
                    Uninstall
                  </button>
                ) : null}
                <div className="relative">
                  <button
                    className="rounded-full border border-white/10 p-1.5 hover:border-flare-300"
                    onClick={() => setDetailMenuOpen((open) => !open)}
                    aria-label="More skill actions"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                  {detailMenuOpen ? (
                    <div className="absolute right-0 mt-2 w-40 rounded-xl border border-white/10 bg-ink-900/95 p-1 shadow-card">
                      <button
                        className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-white/5"
                        onClick={() => handleOverflowAction("copy-id")}
                      >
                        Copy skill ID
                      </button>
                      <button
                        className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-white/5"
                        onClick={() => handleOverflowAction("report")}
                      >
                        Report skill
                      </button>
                    </div>
                  ) : null}
                </div>
                <button
                  className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
                  onClick={() => {
                    setDetailSkill(null);
                    setDetailMenuOpen(false);
                    setDetailMessage(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
