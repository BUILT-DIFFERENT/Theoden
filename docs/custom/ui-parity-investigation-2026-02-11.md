# UI/Flow Parity Investigation (Tauri vs Electron)

Date: February 11, 2026

## Reference inputs

- Electron route registry: `third_party/CodexDesktop-Rebuild/docs/parity/routes.json`
- Electron webview runtime bundle: `third_party/CodexDesktop-Rebuild/src/webview/assets/index-CgwAo6pj.js`
- Electron settings split chunks:
  - `third_party/CodexDesktop-Rebuild/src/webview/assets/agent-settings-aw3nuacG.js`
  - `third_party/CodexDesktop-Rebuild/src/webview/assets/git-settings-BPOHFR8h.js`
  - `third_party/CodexDesktop-Rebuild/src/webview/assets/data-controls-BztS6FgZ.js`
  - `third_party/CodexDesktop-Rebuild/src/webview/assets/personalization-settings-DuRoe2fa.js`
  - `third_party/CodexDesktop-Rebuild/src/webview/assets/local-environments-settings-page-CwZ8Ga_C.js`
  - `third_party/CodexDesktop-Rebuild/src/webview/assets/worktrees-settings-page-Bx5YHGa_.js`
  - `third_party/CodexDesktop-Rebuild/src/webview/assets/mcp-settings-Cq1lXWK_.js`
  - `third_party/CodexDesktop-Rebuild/src/webview/assets/skills-settings-D_IxxpFZ.js`

## Key parity gaps identified

1. Electron route aliases existed without Tauri equivalents (`/announcement`, `/first-run`, `/files`, `/debug`, and several `/wham/*` routes).
2. Deeplink flow did not handle `login`, `welcome`, `select-workspace`, `thread-overlay`, and Electron alias hosts.
3. Thread top bar behavior diverged from Electron by surfacing additional action buttons (`Run`, `Open`, `Commit`) and change counters in primary chrome.
4. Find-in-thread review anchor markers were missing for conversation vs review panes.
5. Remaining larger gaps are mostly in settings subpage fidelity and some desktop-behavior integrations (badge counts/notification actions).

## Changes implemented in this pass

- Added Electron-compatible route aliases in `src/app/router.tsx`:
  - `/announcement`, `/first-run` -> `/welcome`
  - `/files` -> `/file-preview`
  - `/debug` -> `/plan-summary`
  - `/wham/accounts/check` -> `/login`
  - `/wham/environments` -> `/settings/environments`
  - `/wham/tasks`, `/wham/tasks/list` -> `/inbox`
  - `/wham/usage` -> `/settings/usage-analytics`
  - `/wham/worktree_snapshots/finish_upload`, `/wham/worktree_snapshots/upload_url` -> `/settings/worktrees`
- Extended frontend deeplink dispatch in `src/app/components/layout/AppShell.tsx` for:
  - `/login`, `/welcome`, `/select-workspace`, `/file-preview`, `/plan-summary`, `/thread-overlay`
- Extended Tauri deeplink parsing in `src-tauri/src/runtime_contract.rs` for Electron-style hosts:
  - `login`, `welcome`, `announcement`, `first-run`, `select-workspace`, `files`, `debug`, `thread-overlay`
- Simplified thread header UI in `src/app/components/threads/ThreadTopBar.tsx` to be closer to Electron:
  - removed top-level `Run`/`Open`/`Commit` action buttons
  - removed inline diff count badge and loaded-thread suffix in header line
- Added review/conversation find anchors in `src/app/components/layout/AppShell.tsx`:
  - `data-thread-find-anchor="conversation"`
  - `data-thread-find-anchor="review"`

## Remaining recommended parity work

1. Split `SettingsPage` into Electron-matching route-level pages to mirror lazy chunk behavior and layout.
2. Bring shell and route visual tokens closer to Electron baseline CSS (`index-DYqVWCHk.css`) for spacing, typography, and container-query behavior.
3. Implement desktop-level parity behaviors where still missing:
   - approval desktop notifications with action buttons
   - app badge count updates from unread/pending state.

## Follow-up pass updates (February 11, 2026)

- Added remaining route aliases from the Electron route inventory in `src/app/router.tsx`:
  - `/prompts:` -> `/plan-summary`
  - `/settings/*` -> `/settings/$section` (default section fallback)
  - `/settings/$section/*` -> `/settings/$section` (validated section fallback)
  - `/thread-overlay/` -> `/thread-overlay`
- Standardized remote-task route param naming to task semantics:
  - route path now `/remote/$taskId`
  - updated route usage in `src/app/components/layout/AppShell.tsx` and `src/app/routes/RemoteTaskPage.tsx`
- Updated desktop shell marker to Tauri naming:
  - `data-codex-window-type="tauri"` in `src/app/components/layout/AppShell.tsx`
  - matching selector update in `src/styles/index.css`
- Updated file-preview parity copy to desktop wording in `src/app/routes/FilePreviewPage.tsx`.
- Expanded route coverage assertions in `src/app/router.test.tsx` for newly added aliases.
