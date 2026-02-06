import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  installRemoteSkillExperimental,
  listRemoteSkillsExperimental,
  listSkills,
  writeSkillEnabled,
  type RemoteSkillCatalogEntry,
  type SkillCatalogSkill,
} from "@/app/services/cli/skills";
import { startThread, startTurn } from "@/app/services/cli/turns";
import { useWorkspaces } from "@/app/services/cli/useWorkspaces";
import { useAppUi } from "@/app/state/appUi";
import { mockInstalledSkills, mockRemoteSkills } from "@/app/state/skillsData";
import { useRuntimeSettings } from "@/app/state/useRuntimeSettings";
import { useWorkspaceUi } from "@/app/state/workspaceUi";
import type { SkillSource } from "@/app/types";
import { isTauri } from "@/app/utils/tauri";

interface InstalledSkillCard {
  kind: "local";
  id: string;
  name: string;
  description: string;
  documentation: string;
  version: string;
  source: SkillSource;
  permissions: string[];
  path: string;
  enabled: boolean;
  defaultPrompt: string | null;
  scope: "user" | "repo" | "system" | "admin";
}

interface RemoteSkillCard {
  kind: "remote";
  id: string;
  name: string;
  description: string;
  documentation: string;
  version: string;
  source: SkillSource;
  publisher: string;
  tags: string[];
  installable: boolean;
}

type SkillDetail = InstalledSkillCard | RemoteSkillCard;

function sourceFromScope(scope: InstalledSkillCard["scope"]): SkillSource {
  if (scope === "system" || scope === "admin") {
    return "Team";
  }
  return "Community";
}

function mapInstalledSkill(skill: SkillCatalogSkill): InstalledSkillCard {
  return {
    kind: "local",
    id: skill.id,
    name: skill.name,
    description: skill.description,
    documentation: skill.documentation,
    version: "local",
    source: sourceFromScope(skill.scope),
    permissions: skill.permissions,
    path: skill.path,
    enabled: skill.enabled,
    defaultPrompt: skill.defaultPrompt,
    scope: skill.scope,
  };
}

function mapRemoteSkill(skill: RemoteSkillCatalogEntry): RemoteSkillCard {
  return {
    kind: "remote",
    id: skill.id,
    name: skill.name,
    description: skill.description,
    documentation: skill.description,
    version: "preview",
    source: "Community",
    publisher: "Codex Catalog",
    tags: ["remote"],
    installable: true,
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

function dedupeInstalledSkills(skills: InstalledSkillCard[]) {
  const byPath = new Map<string, InstalledSkillCard>();
  skills.forEach((skill) => {
    const existing = byPath.get(skill.path);
    if (!existing) {
      byPath.set(skill.path, skill);
      return;
    }
    byPath.set(skill.path, {
      ...existing,
      enabled: existing.enabled || skill.enabled,
      permissions: Array.from(
        new Set([...existing.permissions, ...skill.permissions]),
      ).sort(),
    });
  });
  return Array.from(byPath.values());
}

export function SkillsPage() {
  const navigate = useNavigate();
  const { setComposerDraft } = useAppUi();
  const runtimeSettings = useRuntimeSettings();
  const { workspaces } = useWorkspaces();
  const { selectedWorkspace } = useWorkspaceUi();
  const [search, setSearch] = useState("");
  const [newSkillOpen, setNewSkillOpen] = useState(false);
  const [detailSkill, setDetailSkill] = useState<SkillDetail | null>(null);
  const [detailMenuOpen, setDetailMenuOpen] = useState(false);
  const [detailMessage, setDetailMessage] = useState<string | null>(null);
  const [skillPath, setSkillPath] = useState("");
  const [skillError, setSkillError] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [submittingSkillAction, setSubmittingSkillAction] = useState(false);
  const skillPathInputId = "new-skill-path";
  const isDesktop = isTauri();
  const resolvedWorkspace = selectedWorkspace ?? workspaces[0]?.path ?? null;
  const remoteSkillsFeatureEnabled =
    isDesktop &&
    runtimeSettings.allowCommunitySkills &&
    (runtimeSettings.showExperimentalConfig ||
      import.meta.env.VITE_ENABLE_REMOTE_SKILLS === "1");

  const localSkillsQuery = useQuery({
    queryKey: ["skills", "list", resolvedWorkspace],
    queryFn: () =>
      listSkills({
        cwds: resolvedWorkspace ? [resolvedWorkspace] : undefined,
        forceReload: false,
      }),
    enabled: isDesktop,
    refetchOnWindowFocus: isDesktop && runtimeSettings.autoRefreshSkills,
  });

  const remoteSkillsQuery = useQuery({
    queryKey: ["skills", "remote", "read"],
    queryFn: listRemoteSkillsExperimental,
    enabled: remoteSkillsFeatureEnabled,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!refreshMessage) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setRefreshMessage(null);
    }, 2000);
    return () => window.clearTimeout(timeoutId);
  }, [refreshMessage]);

  const localSkills = useMemo(() => {
    if (!isDesktop) {
      return mockInstalledSkills.map(
        (skill) =>
          ({
            kind: "local",
            id: skill.id,
            name: skill.name,
            description: skill.description,
            documentation: skill.documentation,
            version: skill.version,
            source: skill.source,
            permissions: skill.permissions,
            path: skill.id,
            enabled: true,
            defaultPrompt: null,
            scope: "repo",
          }) satisfies InstalledSkillCard,
      );
    }
    const mapped = (localSkillsQuery.data ?? []).flatMap((entry) =>
      entry.skills.map((skill) => mapInstalledSkill(skill)),
    );
    return dedupeInstalledSkills(mapped);
  }, [isDesktop, localSkillsQuery.data]);

  const installedSkillPathsById = useMemo(() => {
    const map = new Map<string, string[]>();
    localSkills.forEach((skill) => {
      if (!skill.enabled) {
        return;
      }
      const current = map.get(skill.id);
      if (current) {
        current.push(skill.path);
      } else {
        map.set(skill.id, [skill.path]);
      }
    });
    return map;
  }, [localSkills]);

  const normalizedSearch = search.trim().toLowerCase();
  const installedSkills = useMemo(() => {
    const enabledSkills = localSkills.filter((skill) => skill.enabled);
    if (!normalizedSearch) {
      return enabledSkills;
    }
    return enabledSkills.filter((skill) => {
      const haystack =
        `${skill.name} ${skill.description} ${skill.path}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [localSkills, normalizedSearch]);

  const remoteSkills = useMemo(() => {
    if (!runtimeSettings.allowCommunitySkills) {
      return [] as RemoteSkillCard[];
    }
    const sourceSkills = isDesktop
      ? (remoteSkillsQuery.data ?? []).map((skill) => mapRemoteSkill(skill))
      : mockRemoteSkills.map(
          (skill) =>
            ({
              kind: "remote",
              id: skill.id,
              name: skill.name,
              description: skill.description,
              documentation: skill.documentation,
              version: skill.version,
              source: skill.source,
              publisher: skill.publisher,
              tags: skill.tags,
              installable: skill.installable,
            }) satisfies RemoteSkillCard,
        );
    if (!normalizedSearch) {
      return sourceSkills;
    }
    return sourceSkills.filter((skill) => {
      const haystack =
        `${skill.name} ${skill.description} ${skill.publisher}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [
    isDesktop,
    normalizedSearch,
    remoteSkillsQuery.data,
    runtimeSettings.allowCommunitySkills,
  ]);

  const localCatalogErrors = useMemo(() => {
    if (!isDesktop) {
      return [] as string[];
    }
    return (localSkillsQuery.data ?? []).flatMap((entry) =>
      entry.errors.map((error) => `${error.path}: ${error.message}`),
    );
  }, [isDesktop, localSkillsQuery.data]);

  const handleCloseNewSkill = () => {
    setNewSkillOpen(false);
    setSkillError(null);
  };

  const refreshCatalog = async () => {
    if (!isDesktop) {
      setRefreshMessage("Skill catalog refreshed.");
      return;
    }
    try {
      await listSkills({
        cwds: resolvedWorkspace ? [resolvedWorkspace] : undefined,
        forceReload: true,
      });
      await localSkillsQuery.refetch();
      if (remoteSkillsFeatureEnabled) {
        await remoteSkillsQuery.refetch();
      }
      setRefreshMessage("Skill catalog refreshed.");
    } catch (error) {
      setRefreshMessage(
        error instanceof Error ? error.message : "Failed to refresh skills.",
      );
    }
  };

  const handleCreateSkill = async () => {
    const trimmedPath = skillPath.trim();
    if (!trimmedPath) {
      setSkillError("Skill path is required.");
      return;
    }
    setSubmittingSkillAction(true);
    setSkillError(null);
    try {
      await writeSkillEnabled(trimmedPath, true);
      await refreshCatalog();
      setSkillPath("");
      setNewSkillOpen(false);
    } catch (error) {
      setSkillError(
        error instanceof Error ? error.message : "Failed to add skill.",
      );
    } finally {
      setSubmittingSkillAction(false);
    }
  };

  const handleDetailOpen = (skill: SkillDetail) => {
    setDetailSkill(skill);
    setDetailMenuOpen(false);
    setDetailMessage(null);
  };

  const detailInstalled = detailSkill
    ? detailSkill.kind === "local"
      ? detailSkill.enabled
      : installedSkillPathsById.has(detailSkill.id)
    : false;

  const handleInstallRemoteSkill = async (skill: RemoteSkillCard) => {
    if (!remoteSkillsFeatureEnabled) {
      setDetailMessage("Remote install is disabled.");
      return;
    }
    setSubmittingSkillAction(true);
    try {
      const installed = await installRemoteSkillExperimental(skill.id);
      await writeSkillEnabled(installed.path, true);
      await refreshCatalog();
      setDetailMessage(`Installed ${skill.name}.`);
    } catch (error) {
      setDetailMessage(
        error instanceof Error
          ? error.message
          : `Install failed for ${skill.name}.`,
      );
    } finally {
      setSubmittingSkillAction(false);
    }
  };

  const handleTrySkill = async () => {
    if (!detailSkill) return;
    const fallbackPrompt = `Use $${detailSkill.id} to help with this task.`;
    const runPrompt =
      detailSkill.kind === "local" && detailSkill.defaultPrompt
        ? `$${detailSkill.id} ${detailSkill.defaultPrompt}`
        : fallbackPrompt;

    if (!isDesktop || !resolvedWorkspace) {
      setComposerDraft(runPrompt);
      await navigate({ to: "/" });
      setDetailMessage(`Prepared ${detailSkill.name} in the composer.`);
      return;
    }

    setSubmittingSkillAction(true);
    try {
      const thread = await startThread({ cwd: resolvedWorkspace });
      if (!thread?.id) {
        throw new Error("Unable to create a thread for this skill.");
      }
      const inputItems =
        detailSkill.kind === "local"
          ? [
              { type: "text" as const, text: runPrompt },
              {
                type: "skill" as const,
                name: detailSkill.id,
                path: detailSkill.path,
              },
            ]
          : [{ type: "text" as const, text: runPrompt }];
      await startTurn({
        threadId: thread.id,
        input: runPrompt,
        cwd: resolvedWorkspace,
        inputItems,
      });
      await navigate({ to: "/t/$threadId", params: { threadId: thread.id } });
      setDetailMessage(`Started ${detailSkill.name}.`);
    } catch (error) {
      setDetailMessage(
        error instanceof Error ? error.message : "Failed to start skill run.",
      );
    } finally {
      setSubmittingSkillAction(false);
    }
  };

  const handleOpenSkill = async () => {
    if (!detailSkill) return;
    const prompt = `Use $${detailSkill.id} in this thread.`;
    setComposerDraft(prompt);
    await navigate({ to: "/" });
    setDetailMessage(`${detailSkill.name} ready in composer.`);
  };

  const handleUninstallSkill = async () => {
    if (!detailSkill || detailSkill.kind !== "local") return;
    setSubmittingSkillAction(true);
    try {
      await writeSkillEnabled(detailSkill.path, false);
      await refreshCatalog();
      setDetailMessage(`Uninstalled ${detailSkill.name}.`);
    } catch (error) {
      setDetailMessage(
        error instanceof Error ? error.message : "Failed to uninstall skill.",
      );
    } finally {
      setSubmittingSkillAction(false);
    }
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
      <section className="surface-panel p-5">
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
              className="input-base w-56"
            />
            <button className="btn-flat" onClick={() => setNewSkillOpen(true)}>
              + New skill
            </button>
            <button
              className="btn-flat"
              onClick={() => {
                void refreshCatalog();
              }}
            >
              Refresh
            </button>
          </div>
        </div>
        {refreshMessage ? (
          <p className="mt-3 text-xs text-ink-300">{refreshMessage}</p>
        ) : null}
        {localCatalogErrors.length ? (
          <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/5 p-3 text-xs text-amber-200">
            {localCatalogErrors.slice(0, 3).map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : null}
      </section>

      <section className="surface-panel p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              Installed
            </p>
            <h2 className="font-display text-xl">Skills in your workspace</h2>
          </div>
          {localSkillsQuery.isPending ? (
            <span className="text-xs text-ink-500">Loading…</span>
          ) : null}
        </div>
        <div className="mt-4 space-y-3">
          {installedSkills.map((skill) => (
            <div key={skill.path} className="surface-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink-100">{skill.name}</p>
                <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-ink-300">
                  Installed
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-400">{skill.description}</p>
              <p className="mt-1 text-[0.65rem] text-ink-500">{skill.path}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-300">
                {skill.permissions.map((permission) => (
                  <span
                    key={permission}
                    className="rounded-full border border-white/10 px-2 py-0.5"
                  >
                    {permission}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <button
                  className="btn-flat"
                  onClick={() => handleDetailOpen(skill)}
                >
                  View details
                </button>
              </div>
            </div>
          ))}
          {!installedSkills.length ? (
            <div className="surface-card p-4 text-xs text-ink-400">
              No skills match your search.
            </div>
          ) : null}
        </div>
      </section>

      <section className="surface-panel p-5">
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
        {!runtimeSettings.allowCommunitySkills ? (
          <p className="mt-3 text-xs text-ink-500">
            Community catalog is disabled in settings.
          </p>
        ) : null}
        {runtimeSettings.allowCommunitySkills && !remoteSkillsFeatureEnabled ? (
          <p className="mt-3 text-xs text-ink-500">
            Enable experimental config (or set `VITE_ENABLE_REMOTE_SKILLS=1`) to
            use live remote skills APIs.
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {remoteSkills.map((skill) => (
            <div key={skill.id} className="surface-card p-4">
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
                  className="btn-flat"
                  onClick={() => handleDetailOpen(skill)}
                >
                  View details
                </button>
                <button
                  className="btn-primary disabled:opacity-50"
                  onClick={() => {
                    void handleInstallRemoteSkill(skill);
                  }}
                  disabled={
                    submittingSkillAction ||
                    !skill.installable ||
                    installedSkillPathsById.has(skill.id) ||
                    !remoteSkillsFeatureEnabled
                  }
                >
                  {installedSkillPathsById.has(skill.id)
                    ? "Installed"
                    : "Download"}
                </button>
              </div>
            </div>
          ))}
          {!remoteSkills.length ? (
            <div className="surface-card p-4 text-xs text-ink-400">
              No recommended skills match your search.
            </div>
          ) : null}
        </div>
      </section>

      {newSkillOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="surface-panel w-full max-w-lg p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-ink-50">
                Add skill path
              </h3>
              <button className="btn-flat" onClick={handleCloseNewSkill}>
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-ink-300">
              <div className="space-y-2">
                <label
                  className="text-xs uppercase tracking-[0.2em] text-ink-500"
                  htmlFor={skillPathInputId}
                >
                  Skill path
                </label>
                <input
                  id={skillPathInputId}
                  className="input-base"
                  placeholder="C:/Users/.../.codex/skills/skill-name/SKILL.md"
                  value={skillPath}
                  onChange={(event) => setSkillPath(event.target.value)}
                />
                <p className="text-[0.65rem] text-ink-500">
                  This writes to app-server skill config via
                  `skills/config/write`.
                </p>
              </div>
              {skillError ? (
                <p className="text-xs text-rose-300">{skillError}</p>
              ) : null}
              <div className="flex justify-end gap-2 text-xs">
                <button className="btn-flat" onClick={handleCloseNewSkill}>
                  Cancel
                </button>
                <button
                  className="btn-primary disabled:opacity-60"
                  onClick={() => {
                    void handleCreateSkill();
                  }}
                  disabled={submittingSkillAction}
                >
                  {submittingSkillAction ? "Saving…" : "Add skill"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {detailSkill ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="surface-panel w-full max-w-lg p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-ink-50">
                {detailSkill.name}
              </h3>
              <button className="btn-flat" onClick={() => setDetailSkill(null)}>
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
                {detailSkill.kind === "remote" ? (
                  <span className="rounded-full border border-white/10 px-2 py-0.5">
                    {detailSkill.publisher}
                  </span>
                ) : (
                  <span className="rounded-full border border-white/10 px-2 py-0.5">
                    {detailSkill.scope}
                  </span>
                )}
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
              {detailSkill.kind === "local" ? (
                <div className="space-y-1 text-xs text-ink-400">
                  <p>Path: {detailSkill.path}</p>
                </div>
              ) : null}
              {detailSkill.kind === "local" ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  {detailSkill.permissions.map((permission) => (
                    <span
                      key={permission}
                      className="rounded-full border border-white/10 px-2 py-0.5"
                    >
                      {permission}
                    </span>
                  ))}
                </div>
              ) : null}
              {detailSkill.kind === "remote" ? (
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
                  className="btn-flat disabled:opacity-60"
                  onClick={() => {
                    void handleTrySkill();
                  }}
                  disabled={submittingSkillAction}
                >
                  Try
                </button>
                {detailSkill.kind === "remote" && !detailInstalled ? (
                  <button
                    className="btn-primary disabled:opacity-60"
                    onClick={() => {
                      void handleInstallRemoteSkill(detailSkill);
                    }}
                    disabled={
                      submittingSkillAction || !remoteSkillsFeatureEnabled
                    }
                  >
                    Install
                  </button>
                ) : null}
                <button
                  className="btn-flat"
                  onClick={() => {
                    void handleOpenSkill();
                  }}
                  disabled={!detailInstalled}
                >
                  Open
                </button>
                {detailInstalled && detailSkill.kind === "local" ? (
                  <button
                    className="rounded-full border border-rose-400/40 px-3 py-1 text-rose-200 hover:bg-rose-500/10 disabled:opacity-60"
                    onClick={() => {
                      void handleUninstallSkill();
                    }}
                    disabled={submittingSkillAction}
                  >
                    Uninstall
                  </button>
                ) : null}
                <div className="relative">
                  <button
                    className="btn-flat px-2"
                    onClick={() => setDetailMenuOpen((open) => !open)}
                    aria-label="More skill actions"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                  {detailMenuOpen ? (
                    <div className="surface-card absolute right-0 mt-2 w-40 p-1">
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
                  className="btn-flat"
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
