# Codex Desktop Parity Plan (Codebase-Specific)

This plan replaces the generic merged checklist with tasks mapped to the current Theoden codebase.

Status rule:
- `[x]` means implemented in this repo and kept as baseline.
- `[ ]` means missing, partial, or needs parity-hardening.
- If behavior differs by route or platform, the task stays `[ ]` until all target paths are covered.

## 1) Foundation and Branding

- [ ] Rename desktop product identity to `Codex` everywhere in Tauri config.
  Files: `src-tauri/tauri.conf.json` (`productName`, `mainBinaryName`, `identifier`, window `title`).
- [ ] Update app-server client metadata branding.
  Files: `src/app/components/layout/AppShell.tsx` (`clientInfo.name`, `clientInfo.title`).
- [ ] Remove leftover Theoden naming from persisted keys only if migration is provided.
  Files: `src/app/state/workspaces.ts`, `src/app/state/settings.ts`, `src/app/state/automations.ts`.
  Guidance: implement a one-time localStorage migration map to avoid losing user data.
- [ ] Add native desktop menu parity (File/Edit/View/Window/Help) with accelerators.
  Files: `src-tauri/src/main.rs` (menu setup + command routing).

## 2) Routing and Shell

- [x] Keep canonical route tree based on `/`, `/t/$threadId`, `/automations`, `/skills`, `/settings/$section`.
  Files: `src/app/router.tsx`.
- [ ] Add explicit no-workspace onboarding state before the normal New Thread empty state.
  Files: `src/app/routes/NewThreadPage.tsx`, `src/app/components/threads/ThreadEmptyState.tsx`, `src/app/components/workspaces/WorkspaceModal.tsx`.
- [ ] Show right diff/review panel when launched from New Thread review workflows, not only active thread route.
  Files: `src/app/components/layout/AppShell.tsx`, `src/app/state/threadUi.tsx`.
- [ ] Add route-level loading/error boundaries for app-server failures.
  Files: `src/app/router.tsx`, route components in `src/app/routes`.

## 3) Workspace and Thread Context

- [x] Keep workspace selection persistence and normalization.
  Files: `src/app/state/workspaceUi.tsx`, `src/app/state/workspaces.ts`, `src/app/utils/workspace.ts`.
- [x] Keep workspace list merge strategy (config + local fallback) and dedupe by normalized path.
  Files: `src/app/services/cli/useWorkspaces.ts`.
- [ ] Add explicit workspace removal/unavailability handling with UX fallback.
  Files: `src/app/state/workspaceUi.tsx`, `src/app/components/workspaces/WorkspaceModal.tsx`.
- [ ] Add trust-level surfacing and actions in workspace picker.
  Files: `src/app/components/workspaces/WorkspacePickerDropdown.tsx`, `src/app/services/cli/workspaces.ts`.
- [ ] Ensure all actions consume one resolved workspace source-of-truth helper instead of duplicating fallback logic.
  Files: `src/app/components/threads/ThreadTopBar.tsx`, `src/app/components/layout/BottomBar.tsx`, `src/app/components/threads/ThreadComposer.tsx`, `src/app/components/diff/DiffPanel.tsx`.

## 4) Sidebar Parity

- [x] Keep primary sidebar nav links (`New thread`, `Automations`, `Skills`) and thread grouping by workspace.
  Files: `src/app/components/sidebar/AppSidebar.tsx`.
- [ ] Replace non-target `Providers` block with account/org footer menu.
  Files: `src/app/components/sidebar/AppSidebar.tsx`.
  Guidance: populate from `account/read` via app-server API and include docs/logout actions.
- [ ] Wire filter/sort button to real controls (organize/sort/show), not a decorative icon.
  Files: `src/app/components/sidebar/AppSidebar.tsx`, `src/app/services/cli/useThreads.ts`.
- [ ] Add keyboard shortcuts for `N`, `A`, `S` at app level, while ignoring text inputs.
  Files: `src/app/components/layout/AppShell.tsx`.
- [ ] Add virtualization for large thread/workspace lists.
  Files: `src/app/components/sidebar/AppSidebar.tsx`.

## 5) Top Bar Actions

- [x] Keep run/start flow from top bar and new thread creation fallback.
  Files: `src/app/components/threads/ThreadTopBar.tsx`, `src/app/services/cli/turns.ts`.
- [x] Keep Open dropdown with copy path + editor/terminal/explorer actions.
  Files: `src/app/components/threads/ThreadTopBar.tsx`, `src/app/services/desktop/open.ts`.
- [ ] Drive default Open action from saved settings (`openDestination`).
  Files: `src/app/routes/SettingsPage.tsx`, `src/app/state/settings.ts`, `src/app/components/threads/ThreadTopBar.tsx`.
- [ ] Expand Open target list per OS parity and show platform-specific labels/icons.
  Files: `src/app/components/threads/ThreadTopBar.tsx`, `src/app/services/desktop/open.ts`.
- [ ] Add gh-auth prerequisite UX for Create PR (`next steps`) instead of transient error text.
  Files: `src/app/components/threads/ThreadTopBar.tsx`, `src/app/services/git/commits.ts`.
- [ ] Make git action enable/disable states repo-aware and branch-state-aware.
  Files: `src/app/components/threads/ThreadTopBar.tsx`, `src/app/services/git/useWorkspaceGitStatus.ts`.
- [ ] Wire top-bar overflow button to a real context menu.
  Files: `src/app/components/threads/ThreadTopBar.tsx`.

## 6) Bottom Bar and Environment Controls

- [x] Keep interactive Local/Worktree/Cloud mode controls and branch switching.
  Files: `src/app/components/layout/BottomBar.tsx`, `src/app/state/environmentUi.tsx`.
- [ ] Replace environment pills with target-style `Continue in` dropdown and explicit option descriptions.
  Files: `src/app/components/layout/BottomBar.tsx`.
- [ ] Add permission profile dropdown and pass policy to `command/exec` calls.
  Files: `src/app/components/layout/BottomBar.tsx`, `src/app/services/cli/commands.ts`.

## 7) New Thread Empty State

- [x] Keep centered `Let's build` state with workspace dropdown and starter cards.
  Files: `src/app/components/threads/ThreadEmptyState.tsx`.
- [ ] Replace fixed 3-card prompt list with categorized task catalog and `Start with a task` dropdown.
  Files: `src/app/components/threads/ThreadEmptyState.tsx`.
- [ ] Wire `Explore more` button to open task catalog or templates route.
  Files: `src/app/components/threads/ThreadEmptyState.tsx`.
- [ ] Add explicit onboarding CTA pair (`Add project`, `Skip`) when no workspace exists.
  Files: `src/app/routes/NewThreadPage.tsx`, `src/app/components/workspaces/WorkspaceModal.tsx`.

## 8) Composer Parity

- [x] Keep send flow, branch controls, run progress ring, and attachment chips.
  Files: `src/app/components/threads/ThreadComposer.tsx`.
- [ ] Remove or feature-flag non-target `Agent` selector unless target parity explicitly needs it.
  Files: `src/app/components/threads/ThreadComposer.tsx`.
- [ ] Remove or implement lock semantics; current lock button is visual-only.
  Files: `src/app/components/threads/ThreadComposer.tsx`.
- [ ] Apply `compactComposer` setting to actual composer layout variants.
  Files: `src/app/routes/SettingsPage.tsx`, `src/app/state/settings.ts`, `src/app/components/threads/ThreadComposer.tsx`.
- [ ] Implement real `@` file index from selected workspace rather than fallback hardcoded list.
  Files: `src/app/components/threads/ThreadComposer.tsx`.
  Guidance: build index via `command/exec` (`rg --files`) with debounce and cache by workspace path.
- [ ] Add keyboard navigation in `@` and `/` menus (ArrowUp/ArrowDown/Tab/Enter/Escape).
  Files: `src/app/components/threads/ThreadComposer.tsx`.
- [ ] Convert `/` command items from text insertion to executable actions.
  Files: `src/app/components/threads/ThreadComposer.tsx`, related service modules under `src/app/services`.
- [ ] Implement real stop/cancel behavior for active runs.
  Files: `src/app/components/threads/ThreadComposer.tsx`, app-server bridge/services.

## 9) Thread View and Timeline

- [x] Keep thread route with message stream, optimistic user message append, and bottom-stick autoscroll behavior.
  Files: `src/app/routes/ThreadPage.tsx`.
- [x] Keep markdown-style message rendering with code block copy actions.
  Files: `src/app/components/threads/ThreadMessages.tsx`.
- [ ] Replace custom markdown parsing with a robust renderer supporting nested structures and links safely.
  Files: `src/app/components/threads/ThreadMessages.tsx`.
- [ ] Integrate run timeline (`RunTimeline`) into active thread page or remove dead path.
  Files: `src/app/components/runs/RunTimeline.tsx`, `src/app/routes/ThreadPage.tsx`.

## 10) Diff and Review Panel

- [x] Keep staged/unstaged tabs, file selection, diff parsing, context collapsing, and stage/revert actions.
  Files: `src/app/components/diff/DiffPanel.tsx`, `src/app/services/git/changes.ts`, `src/app/services/git/diff.ts`.
- [x] Keep line-level `Request change` interaction and custom event emission.
  Files: `src/app/components/diff/DiffPanel.tsx`.
- [ ] Replace per-file stage/revert controls with true per-hunk actions where target expects hunk-level operations.
  Files: `src/app/components/diff/DiffPanel.tsx`, git service layer.
- [ ] Persist review annotations into thread history/state instead of session-only in-memory list.
  Files: `src/app/components/diff/DiffPanel.tsx`, `src/app/services/cli/threadMessages.ts` or dedicated annotation service.
- [ ] Wire folder/open and overflow header buttons.
  Files: `src/app/components/diff/DiffPanel.tsx`.

## 11) Terminal Drawer

- [x] Keep global toggle from top bar and `Ctrl/Cmd+J` shortcut wiring.
  Files: `src/app/components/layout/AppShell.tsx`, `src/app/components/threads/ThreadTopBar.tsx`.
- [ ] Replace static terminal transcript with real streaming command output.
  Files: `src/app/components/layout/TerminalDrawer.tsx`, `src/app/services/cli/commands.ts`.
- [ ] Add terminal session scoping per workspace/thread and persist recent output.
  Files: `src/app/components/layout/TerminalDrawer.tsx`, new terminal state/service module.
- [ ] Add clear output and copy-selection actions.
  Files: `src/app/components/layout/TerminalDrawer.tsx`.

## 12) Worktree, Branch, Commit, PR Flows

- [x] Keep worktree creation modal and log output flow.
  Files: `src/app/components/threads/ThreadModals.tsx`, `src/app/services/git/worktrees.ts`.
- [x] Keep branch creation and commit/push/PR modal flows.
  Files: `src/app/components/threads/ThreadModals.tsx`, `src/app/services/git/commits.ts`.
- [ ] Implement real cancelation for in-progress worktree creation.
  Files: `src/app/components/threads/ThreadModals.tsx`, `src/app/services/git/worktrees.ts`.
- [ ] Use saved worktree settings (`strategy`, prefix, retention) in worktree and branch flows.
  Files: `src/app/state/settings.ts`, `src/app/routes/SettingsPage.tsx`, `src/app/services/git/worktrees.ts`.
- [ ] Implement `mergeWorkspace` and wire `Bring back to main` actions.
  Files: `src/app/services/git/worktrees.ts`, `src/app/components/threads/ThreadMetaPanel.tsx` or integrated thread actions.

## 13) Automations

- [x] Keep automation list/create modal with local persistence.
  Files: `src/app/routes/AutomationsPage.tsx`, `src/app/state/automations.ts`.
- [ ] Wire `Learn more` to real docs/help target.
  Files: `src/app/routes/AutomationsPage.tsx`.
- [ ] Add Run now and execution history fields backed by real run events.
  Files: `src/app/routes/AutomationsPage.tsx`, app-server service layer.
- [ ] Move schedule model from display string to normalized recurrence payload.
  Files: `src/app/state/automations.ts`, `src/app/routes/AutomationsPage.tsx`.

## 14) Skills

- [x] Keep installed/recommended sections, search, detail modal, install/uninstall, and try/open actions.
  Files: `src/app/routes/SkillsPage.tsx`.
- [ ] Replace mock catalogs with `skills/list` and experimental remote skills APIs behind feature flag.
  Files: `src/app/routes/SkillsPage.tsx`, new/extended service module under `src/app/services/cli`.
- [ ] Make `Try` start or seed a real thread turn instead of only prefill + navigate.
  Files: `src/app/routes/SkillsPage.tsx`, `src/app/services/cli/turns.ts`.
- [ ] Persist custom/new skills through app-server config instead of local-only arrays.
  Files: `src/app/routes/SkillsPage.tsx`, skills service modules.

## 15) Settings

- [x] Keep multi-section settings nav and persisted snapshots.
  Files: `src/app/routes/SettingsPage.tsx`, `src/app/state/settings.ts`, `src/app/state/settingsData.ts`.
- [ ] Apply saved theme globally (currently saved but not applied to document classes).
  Files: `src/main.tsx`, `src/styles/index.css`, `src/app/routes/SettingsPage.tsx`.
- [ ] Apply `defaultOpenDestination` and follow-up behavior to runtime controls.
  Files: `src/app/routes/SettingsPage.tsx`, top bar/composer components.
- [ ] Wire placeholder action buttons in settings (config file open/validate, MCP add/reload, prune now, archive restore).
  Files: `src/app/routes/SettingsPage.tsx`.
- [ ] Replace mock MCP/provider data with live app-server values.
  Files: `src/app/routes/SettingsPage.tsx`, service layer under `src/app/services/cli`.

## 16) App-Server and Event Integration

- [x] Keep app-server bootstrap and event subscriptions (`initialize` -> `initialized`).
  Files: `src/app/components/layout/AppShell.tsx`, `src/app/services/cli/useAppServerStream.ts`, `src-tauri/src/main.rs`.
- [ ] Add reconnect strategy when app-server child exits or times out.
  Files: `src-tauri/src/main.rs`, `src/app/services/cli/appServer.ts`, bootstrap flow in `AppShell.tsx`.
- [ ] Centralize request-id generation and response typing to avoid per-file nonce drift.
  Files: modules under `src/app/services/cli`.
- [ ] Surface approvals UI in active thread view; currently approvals plumbing exists but panel is not rendered.
  Files: `src/app/components/threads/ApprovalsPanel.tsx`, `src/app/routes/ThreadPage.tsx`.
- [ ] Expand account/auth integration (`account/read`, login/logout) and connect to sidebar footer menu.
  Files: service modules + `src/app/components/sidebar/AppSidebar.tsx`.

## 17) Visual and Interaction Parity

- [x] Keep custom typography and design tokens baseline.
  Files: `src/styles/index.css`, `tailwind.config.ts`.
- [ ] Reduce Command-Center style blur/chrome where target uses flatter surfaces.
  Files: layout and page components under `src/app/components` and `src/app/routes`.
- [ ] Standardize spacing/radius/hover tokens across sidebar/cards/popovers.
  Files: `tailwind.config.ts`, shared utility class constants or component primitives.
- [ ] Add consistent scrollbars for sidebar/main/diff/terminal containers.
  Files: `src/styles/index.css`.
- [ ] Verify icon usage consistency and remove dead icon-only buttons.
  Files: all top-level UI components in `src/app/components`.

## 18) No-op Cleanup and Dead Surfaces

- [x] Keep dev interaction audit hook for route/click logging and smoke highlighting.
  Files: `src/app/services/dev/useInteractionAudit.ts`, `src/styles/index.css`.
- [ ] Eliminate remaining no-op controls (`Explore more`, settings placeholder actions, filter/menu buttons, lock button, diff header folder/menu).
  Files: route and component files listed in sections above.
- [ ] Remove or integrate orphan components not in route tree (`ThreadMetaPanel`, `FilesChangedCard`) to avoid drift.
  Files: `src/app/components/threads/ThreadMetaPanel.tsx`, `src/app/components/diff/FilesChangedCard.tsx`.

## 19) Verification and Delivery Gates

- [ ] Add parser/service unit tests for diff/status/message mapping.
  Files: tests adjacent to `src/app/services/cli/diffSummary.ts`, `src/app/services/git/status.ts`, `src/app/services/cli/threadMessages.ts`.
- [ ] Add integration tests for workspace switching propagation (sidebar/header/composer/bottom bar).
  Files: component tests for `AppShell`, `AppSidebar`, `ThreadTopBar`, `BottomBar`.
- [ ] Add interaction smoke test in CI using `VITE_UI_SMOKE_TEST=1`.
  Files: test runner config + CI workflow.
- [ ] Require this command gate before parity sign-off.
  Commands: `pnpm lint`, `pnpm format:app`, `pnpm app:build`.
- [ ] Add manual parity checklist with screenshots for canonical states.
  Files: `docs/custom/parity-checklist.md` (new).

## 20) Recommended Execution Order

- [x] Phase A: Branding + no-op elimination + settings wiring.
- [ ] Phase B: Sidebar/account/footer + onboarding + composer parity hardening.
- [ ] Phase C: Terminal streaming + worktree/PR hardening + approvals surface.
- [ ] Phase D: Skills/automations live APIs + visual parity polish + tests.

Extra guidance:
- Keep UI state in providers under `src/app/state`, but move network/business logic into `src/app/services`.
- Prefer app-server methods over local mock data whenever an API exists.
- For parity work, capture before/after screenshots for each route (`/`, `/t/:id`, `/automations`, `/skills`, `/settings/:section`) on desktop widths.
