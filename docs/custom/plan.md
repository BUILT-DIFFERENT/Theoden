# Codex Desktop Clone — Gap Analysis & Required Changes (Actual App vs Agent Build)

This document lists **everything I can confirm from the two screen recordings**:

- [ ] **Actual Codex desktop app recording** (`actual-codex-app.mp4`, ~9:15)
- [ ] **Agent-built clone recording** (`codex-desktop-agent.mp4`, ~1:26)

> Note: the clone recording is dominated by an **“APP‑SERVER UNAVAILABLE”** state, so several flows can’t be validated end-to-end from video. Where that happens, I mark the item as **[UNVERIFIED IN CLONE]** and still describe what the real app does (from the actual recording) so you can implement it.

---

## Backend parity milestone update (February 7, 2026)

- [x] Added host-side persisted atom API (`persisted_atom_sync`, `persisted_atom_update`, `persisted_atom_reset`) and wired desktop state modules to mirror host persistence.
- [x] Added host-side SQLite + TOML automation persistence and inbox records (`automations`, `automation_runs`, `inbox_items`) with Tauri automation/inbox commands.
- [x] Added host terminal command channel with `terminal_create/attach/write/resize/close` and streaming events (`terminal-attached`, `terminal-data`, `terminal-error`, `terminal-exit`).
- [x] Moved Automations page data authority from localStorage to host APIs, including one-time migration of legacy localStorage automations.
- [x] Removed desktop mock fallback behavior in thread list/detail data hooks so desktop mode now uses real/cached backend data only.
- [x] Added settings runtime reads for MCP/auth status via `mcpServerStatus/list` and `getAuthStatus`.
- [x] Added parity contract doc: `docs/custom/parity-backend-v1.md`.
- [x] Added persisted sidebar UI state for thread list controls (`sort/filter`), expanded workspace folders, and scroll restoration.
- [x] Added archived-thread row restore actions in Settings and automation create-sheet safety parity details (warning callout + backdrop close).
- [x] Added verification coverage for these parity areas in frontend + Rust tests.

---

## Electron parity gaps still open (February 7, 2026)

- [ ] **Cloud execution parity (still stubbed):** Implement full cloud orchestration so selecting cloud mode starts real runs, emits `thread/start` + `turn/start` lifecycle, and supports environment/branch/attempt options without throwing a placeholder error. Electron reference: `third_party/CodexDesktop-Rebuild/tmp/codex-wakaru/unminify-safe/third_party/CodexDesktop-Rebuild/src/.vite/build/main-CQwPb0Th.js:39601`, `third_party/CodexDesktop-Rebuild/tmp/codex-wakaru/unminify-safe/third_party/CodexDesktop-Rebuild/src/.vite/build/main-CQwPb0Th.js:22342`, `third_party/CodexDesktop-Rebuild/tmp/codex-wakaru/unminify-safe/third_party/CodexDesktop-Rebuild/src/.vite/build/main-CQwPb0Th.js:39627`.
- [ ] **Thread history/lifecycle RPC parity:** Replace local placeholders/stubs for listing/resuming threads with real app-server-backed `thread/list`, `thread/resume`, `thread/read`, archive/unarchive wiring and pagination/filter semantics matching Electron behavior. Electron reference: `third_party/CodexDesktop-Rebuild/tmp/codex-wakaru/unminify-safe/third_party/CodexDesktop-Rebuild/src/.vite/build/main-CQwPb0Th.js:39601`, `third_party/CodexDesktop-Rebuild/signal-parity-map.md:12`, `third_party/CodexDesktop-Rebuild/signal-parity-map.md:14`.
- [ ] **Terminal PTY parity (interactive shell):** Upgrade terminal host from stateless command streaming to true PTY-backed interactive sessions with resize support, long-lived shell state, and terminal capability parity with Electron. Electron reference: `third_party/CodexDesktop-Rebuild/tmp/codex-wakaru/unminify-safe/third_party/CodexDesktop-Rebuild/src/.vite/build/main-CQwPb0Th.js:42041`.
- [x] **Settings information architecture parity:** Added Account, Data controls, and Usage & analytics sections in settings navigation with live account actions, local data path controls, browser-open links, and runtime usage reads/refresh via `account/rateLimits/read` + `account/rateLimits/updated`. Electron reference: `third_party/CodexDesktop-Rebuild/src/webview/assets/index-CgwAo6pj.js:2525`, `third_party/CodexDesktop-Rebuild/src/webview/assets/index-CgwAo6pj.js:2845`.
- [ ] **MCP settings persistence parity:** Replace session-only MCP add/edit behavior with persisted config-backed mutation flows (create/update/delete, reconnect, validation, and status refresh) so changes survive restart like official app behavior. Electron reference: `third_party/CodexDesktop-Rebuild/src/webview/assets/index-CgwAo6pj.js:181`, `third_party/CodexDesktop-Rebuild/signal-parity-map.md:26`.
- [ ] **Config validation parity:** Implement real validation against merged config schema and runtime constraints (not always-valid placeholders), including actionable per-key errors shown in Configuration settings. Electron reference: `third_party/CodexDesktop-Rebuild/src/webview/assets/index-CgwAo6pj.js:2525`.
- [x] **Worktrees management parity (row-level operations):** Added worktree inventory table in Settings with `git worktree list --porcelain` parsing, row-scoped actions (open folder, open linked conversation, remove), main-worktree delete guardrails, and explicit loading/empty/error states. Electron reference: `third_party/CodexDesktop-Rebuild/src/webview/assets/worktrees-settings-page-Bx5YHGa_.js:1`.
- [ ] **Sidebar interaction parity and polish:** Implement pinned threads, rename/archive thread actions, group-by workspace/recency parity, and automations inbox route affordance; remove truncating behavior that limits visible threads per workspace. Electron reference: `third_party/CodexDesktop-Rebuild/src/webview/assets/index-CgwAo6pj.js:1624`.
- [x] **Automation schedule semantics parity:** Recurrence now uses canonical daily/weekly/monthly RRULE semantics in frontend + backend scheduler with legacy monthly-hourly fallback support (`FREQ=HOURLY;INTERVAL=720`) and normalization on read/write. Electron reference: `third_party/CodexDesktop-Rebuild/tmp/codex-wakaru/unminify-safe/third_party/CodexDesktop-Rebuild/src/.vite/build/main-CQwPb0Th.js:15069`, `third_party/CodexDesktop-Rebuild/tmp/codex-wakaru/unminify-safe/third_party/CodexDesktop-Rebuild/src/.vite/build/main-CQwPb0Th.js:18360`, `third_party/CodexDesktop-Rebuild/tmp/codex-wakaru/unminify-safe/third_party/CodexDesktop-Rebuild/src/.vite/build/main-CQwPb0Th.js:21906`, `third_party/CodexDesktop-Rebuild/src/webview/assets/index-CgwAo6pj.js:2824`.
- [ ] **Protocol parity map closure:** Resolve remaining `TBD` items in signal mapping (thread/turn/approval/auth surfaces), and close documented OAuth parity deferrals with implemented v2-compatible flows and audits. Electron reference: `third_party/CodexDesktop-Rebuild/signal-parity-map.md:12`, `third_party/CodexDesktop-Rebuild/signal-parity-map.md:32`, `third_party/CodexDesktop-Rebuild/README.md:131`.

---

## 0) Executive summary (P0 blockers)

Platform scope: this Tauri app targets Windows and Linux only. macOS is out of scope.

### P0 — must fix before “full clone” is even testable
1. [ ] **Remove/repair the “app-server bootstrap” dependency**: the clone UI is effectively non-functional due to a hard error panel (“APP‑SERVER UNAVAILABLE / App‑server bootstrap failed.”). The real app does **not** present this gate during normal use.
2. [x] **Rebuild left navigation + thread list to match the real app** (information architecture, spacing, typography, grouping, row affordances).
3. [x] **Match top-bar semantics** (real app: thread title + workspace label + overflow menu; clone: “Run/Open” controls that do not exist in the real app UI shown).
4. [ ] **Implement the core screens the real app has**: New thread home, Thread view (assistant output + command log blocks), Automations templates + creation sheet, Settings (multi-section), Git/changes viewing.

---

## 1) Reference UI from the actual recording (what we’re cloning)

### 1.1 Left side navigation (real app)
Real app uses a **single left sidebar** containing:
- [ ] A compact **icon/label nav** at top: **New thread**, **Automations**, **Skills** (each with an icon).
- [ ] A “Threads” section below with:
  - [ ] **Workspace “folders”** (e.g., “Codex‑Windows”, “Handy”).
  - [ ] Threads listed beneath each workspace.
  - [ ] Per-thread metadata: **relative time** (e.g., “4h”, “2d”), and for some threads **git change counters** like **+76 −30** and/or an **unread dot**.
  - [ ] Small controls near “Threads” header (icons consistent with “add” and “sort/filter”).

### 1.2 New thread home (real app)
The “New thread” screen is intentionally minimal:
- [x] Empty main canvas with a large **“Let’s build”** headline.
- [x] A **workspace selector** rendered near the “Let’s build” label (dropdown caret).
- [x] A large floating/illustrative icon near the headline.

### 1.3 Thread view (real app)
The thread view is a **chat-like transcript**, but *not* “bubble chat”:
- [x] Assistant output is rendered as markdown: headings, lists, inline code, links.
- [x] The app includes **execution logs** (e.g., repeated “Ran …” lines for commands) and a compact **“Worked for Xm Ys”** duration indicator.
- [x] There is a **copy icon** for assistant message content (visible near the bottom of the assistant message block in the actual recording).

### 1.4 Automations (real app)
Automations has:
- [x] Page title **“Automations”** with a **“Beta”** pill badge.
- [x] Subtitle: “Automate work by setting up scheduled threads.” with a **Learn more** link.
- [x] A “Start with a template” section showing **template cards in a grid** (2 columns in the recording), each card with:
  - [x] A small icon/emoji tile top-left
  - [x] Title/description copy
  - [x] Hover/focus affordances
- [x] Clicking a template opens a **right-side creation sheet** (“Create automation”) containing:
  - [x] A prominent **red warning callout** about sandbox settings and risk, with inline links (“rules”, etc.).
  - [x] Fields: **Name**, **Projects** (chip/tokens), **Prompt** (multiline).
  - [x] The sheet overlays the main page while leaving the left sidebar visible.
- [x] Automation state is persisted in SQLite (observable in `~/.codex/sqlite/codex-dev.db` via `uvx datasette`), including:
  - [x] `automations` table (`id`, `name`, `prompt`, `status`, `next_run_at`, `last_run_at`, `cwds`, `rrule`, timestamps).
  - [x] `automation_runs` table (`thread_id`, `automation_id`, status/read fields, inbox summary/title, archival fields, timestamps).
  - [x] `inbox_items` table (`id`, `title`, `description`, `thread_id`, `read_at`, `created_at`).

### 1.5 Settings (real app)
Settings is a distinct section with its own internal navigation list:
- [ ] Left settings nav items include (as seen): **General, Configuration, Personalization, MCP servers, Git, Environments, Worktrees, Archived threads**.
- [ ] Example shown: **Environments** → select “Codex‑Windows” → edit form with environment details.

### 1.6 Changes / diff viewing (real app)
The real app shows git-related UI in at least two ways:
- [ ] A right-side “changes” context panel in some thread views (uncommitted changes / status).
- [ ] A full “changes/diff” view showing:
  - [ ] File path headers
  - [ ] Line numbers
  - [ ] Green-highlighted added blocks
  - [ ] Per-file change counts

---

## 2) Confirmed differences (clone vs real) and required changes

### 2.1 Global layout & navigation

#### ✅ Real app behavior/appearance
- [ ] Left sidebar is **compact** and utilitarian (no “Navigation” headline).
- [ ] Navigation items are **icon + label**, with subtle hover/selected backgrounds.
- [ ] Threads are grouped under workspaces (folder-like).

#### ❌ Clone behavior/appearance
- [ ] Left sidebar uses a prominent **“Navigation”** heading and “CODEX” label.
- [ ] Adds sections “RECENTS” and “THREADS” with pill buttons (“+ Add”, “Sort”).
- [ ] Shows shortcut letters (N/A/S) aligned at right of nav rows.
- [ ] UI appears to use heavier “glass/blur” styling than the real app.

#### Required changes
- [x] Remove the **“Navigation”** header + “CODEX” wordmark presentation. Replace with the real app’s compact icon+label block.
- [x] Remove right-aligned shortcut letters (N/A/S) from the sidebar rows (real app doesn’t show them persistently).
- [x] Replace “RECENTS” section with the real app’s **workspace-grouped thread list**.
- [x] Implement the real app’s **Threads header row** including the small icon buttons for add/sort/filter.
- [x] Match sidebar width (~25–30% of window in the recording) and internal spacing.

---

### 2.2 Top bar / window chrome

#### ✅ Real app
- [ ] Thread view top bar contains: **thread title**, **workspace label**, and a **“…” overflow** menu.
- [ ] New thread screen shows a simple “New thread” header in the main area (not a toolbar full of controls).
- [ ] No visible “Run” and “Open” primary actions in the top-right (in the portions shown).

#### ❌ Clone
- [ ] Persistent **Run** and **Open** buttons in the top-right (plus extra controls like “Git”) regardless of page.
- [ ] Title bar area doesn’t match the real app’s thread header semantics.

#### Required changes
- [x] Remove **Run/Open** from the primary top bar and align with the real app:
  - [x] In thread view: show **[Thread title] [Workspace] […]**
  - [x] In New thread: show minimal header (“New thread”) and keep the emphasis on the “Let’s build” canvas.
  - [x] Settings/Automations: show the page title only (plus small contextual actions if the real app has them).
- [ ] Ensure the app icon/title in the OS chrome matches the real app (real shows Codex mark; clone shows orange dot).

---

### 2.3 App initialization / backend connectivity (critical)

#### ✅ Real app
- [ ] Opens into working UI without a blocking “app-server bootstrap failed” state in the recording.

#### ✅ Clone (updated)
- [x] Shows a non-blocking banner when the app-server is unavailable; routes remain accessible.

#### Required changes (P0)
- [x] Rework backend architecture so the UI can render and be usable even if:
  - [x] the CLI is not found / not configured
  - [x] the selected workspace has issues
  - [x] background services are down  
- [ ] Replace “app-server” with a Codex-native model:
  - [ ] Use Tauri/Rust commands (IPC) to call the Codex CLI directly and stream results
  - [ ] Or, if a local server is necessary, embed lifecycle management so it starts reliably and the UI degrades gracefully.
- [ ] Implement a real-app-like empty/error state:
  - [x] Show a small banner/toast and guidance, **not** a full-page block that prevents navigation.
  - [x] Keep thread list + thread detail usable via cached/mock fallback data while reconnecting or disconnected.

---

### 2.4 New thread home (“Let’s build”)

#### ✅ Real app
- [x] Large “Let’s build” text at the lower-right quadrant.
- [x] Workspace name below with dropdown caret.
- [x] Minimal rest of the canvas.

#### ❌ Clone
- [ ] Shows “New thread” in top bar with “Pick a workspace” microcopy.
- [ ] Main canvas occupied by the app-server error card.

#### Required changes
- [x] Implement real layout:
  - [x] Center/empty canvas
  - [x] “Let’s build” + workspace dropdown anchored at bottom-right area
  - [x] Decorative icon near the headline (real app uses a large outline icon)
- [x] Ensure no blocking system errors cover this surface.

---

### 2.5 Thread list (left sidebar)

#### ✅ Real app
- [ ] Workspaces appear like folders and group threads beneath them.
- [ ] Thread rows include:
  - [ ] Truncated title
  - [ ] Relative age on the right (“4h”, “2d”, …)
  - [ ] Optional **unread dot**
  - [ ] Optional **git change counters** (e.g., “+76 −30”)
  - [ ] Some rows show a **pin** icon on the left when pinned/active
  - [ ] Some rows show a small “open/changes” icon on the right when applicable

#### ❌ Clone
- [ ] Shows no real workspaces detected and a generic empty state.
- [ ] Different row styling and controls (“+ Add”, “Sort”).

#### Required changes
- [ ] Build a thread list component that supports:
  - [ ] Workspace grouping and expand/collapse
  - [ ] Sorting (by recency) identical to real behavior
  - [ ] Per-row metadata: age, unread dot, change counters
  - [ ] Active row highlight that matches the real app (subtle rounded rectangle)
  - [ ] Context actions on hover (pin, overflow, open diff) consistent with real affordances
- [ ] Persist:
  - [ ] last selected workspace
  - [x] expanded workspace folders
  - [x] scroll position of thread list

---

### 2.6 Thread view content rendering (chat transcript)

#### ✅ Real app
- [x] Markdown rendering with:
  - [x] Bulleted lists
  - [x] Inline code as pill chips (rounded background)
  - [x] Links in muted blue
- [x] Execution log lines prefixed by “Ran …” and grouped visually
- [x] “Worked for Xm Ys” indicator aligned on the right
- [x] Copy-to-clipboard icon for assistant content

#### ❌ Clone
- [ ] Not observable due to app-server error and no thread content shown.

#### Required changes
- [x] Implement a message renderer that matches:
  - [x] Typography scale (real app uses larger body text, generous line height)
  - [x] Inline code pill style (dark pill with light text)
  - [x] Code blocks (monospace, subtle background, padding, scroll)
  - [x] Message spacing (no chat bubbles; full-width blocks)
  - [x] Copy icon placement and hover behavior
- [x] Add an “agent activity” subcomponent:
  - [x] “Ran …” lines rendered in a distinct style
  - [x] Collapsible grouping for long command logs (recommended)
  - [x] Duration indicator “Worked for …”

---

### 2.7 Git / changes viewing (right panel + full diff view)

#### ✅ Real app
- [ ] Right-side context panel appears in thread view for git/uncommitted changes.
- [ ] A dedicated changes/diff view exists:
  - [ ] File header rows
  - [ ] Per-file change counts
  - [ ] Inline diff styling (green additions visible)
  - [ ] Line numbers

#### ❌ Clone
- [ ] Not observable.

#### Required changes
- [ ] Add a **right-side panel** component:
  - [ ] Toggleable / collapsible
  - [ ] Shows git status, changed files list, and quick actions
- [ ] Add a **diff viewer** route/view:
  - [ ] Side-by-side or unified diff (real looks unified in the recording)
  - [ ] Syntax highlighting for code (optional but recommended)
  - [ ] Accurate +/− counters
- [ ] Wire this to Codex CLI outputs (status/diff) and to “thread worktrees” behavior.

---

### 2.8 Automations page (templates grid)

#### ✅ Real app
- [x] “Automations” title with **Beta** badge
- [x] Subtitle and Learn more link
- [x] Template cards grid with consistent card sizing and icon tile

#### ❌ Clone
- [ ] Navigates to an “Automations” page but content is blocked by app-server error.
- [ ] Sidebar styling differs from real app.

#### Required changes
- [x] Match the Automations page layout:
  - [x] Header typography (“Automations” large)
  - [x] Beta badge size/shape
  - [x] Template cards: padding, corner radius, hover elevation, icon tile
  - [x] Two-column responsive grid (in the recording window size)
- [x] Ensure templates populate even without workspaces (or show a soft empty state explaining requirement).
- [ ] Load schedule/status metadata from SQLite-backed automation records (`status`, `next_run_at`, `last_run_at`) instead of static/mock values.

---

### 2.9 Create automation sheet (modal)

#### ✅ Real app
- [x] Opens as a **right-side overlay sheet** (“Create automation”)
- [ ] Contains:
  - [x] Red warning callout about sandbox settings
  - [x] Name field
  - [x] Projects chips/tokens
  - [x] Prompt textarea

#### ❌ Clone
- [ ] Not shown.

#### Required changes
- [x] Implement a right-side sheet component with:
  - [x] Rounded corners and shadow
  - [x] Scrollable internal content
  - [x] Escape key to close, click-outside to close
  - [x] Focus trap for accessibility
- [x] Implement form components that visually match real app:
  - [x] Text input styling
  - [x] Chip/tokens with remove “x”
  - [x] Multiline prompt box
  - [x] Primary/secondary actions (not visible in frame; ensure there is a save/create CTA consistent with real app)
- [x] Persist created/updated automation rows into SQLite (`automations` table) with canonical fields (`name`, `prompt`, `status`, `cwds`, `rrule`, timestamps).
- [x] Ensure scheduler lifecycle updates `next_run_at`/`last_run_at` and reflects them in UI, with completion-driven run transitions (`PENDING_REVIEW`/`FAILED`/`INTERRUPTED`) and idempotent inbox reconciliation on `turn/completed`.

---

### 2.10 Settings section

#### ✅ Real app
- [ ] Left settings nav with categories:
  - [ ] General
  - [ ] Configuration
  - [ ] Personalization
  - [ ] MCP servers
  - [ ] Git
  - [ ] Environments
  - [ ] Worktrees
  - [ ] Archived threads
- [x] Environments page supports selecting and editing an environment.

#### ❌ Clone
- [ ] A “Settings” title exists but appears to be the same error canvas.

#### Required changes
- [ ] Implement Settings as a first-class route with internal nav.
- [ ] Match nav typography, spacing, and active state.
- [ ] Implement at minimum:
  - [x] Environments list
  - [x] Environment edit view (name, paths, etc.)
  - [ ] Git settings stub (if not fully implemented yet)
  - [ ] Archived threads view (list + restore/delete actions)

---

## 3) Visual design tokens to align (based on the actual recording)

> Exact values will require inspecting the source CSS from the real app, but these are consistent with what’s visible in-frame.

### 3.1 Color & contrast
- [ ] Base background: very dark neutral (~#181818).
- [ ] Sidebar background: slightly differentiated from main canvas (subtle gradient).
- [ ] Text:
  - [ ] Primary: near-white (#E6E6E6)
  - [ ] Secondary: muted gray (#A0A0A0)
- [ ] Links: muted blue (real app uses subtle, not neon)
- [ ] Diff colors: green additions, red deletions (with muted saturation)

### 3.2 Typography
- [ ] Use system UI font stack (SF/Segoe/Inter-like).
- [ ] Larger-than-default body size and generous line-height for assistant output.
- [ ] Page titles (“Automations”, “Settings”) are large and bold.

### 3.3 Shape, elevation, and motion
- [ ] Rounded rectangles throughout (medium radius).
- [ ] Cards and sheets use soft shadow and subtle elevation.
- [ ] Hover states are understated (background tint, slight elevation).

---

## 4) Functional parity checklist (what to implement to claim “full clone”)

### 4.1 Core
- [ ] Workspace discovery + selection (matches real behavior and placement)
- [ ] Thread creation, listing, selection, and persistence
- [x] Thread transcript rendering (markdown + logs + copy)
- [ ] Git status panel + diff viewer

### 4.2 Automations
- [x] Templates page
- [x] Create automation sheet
- [x] Scheduling + background execution on worktrees
- [x] SQLite-backed automation persistence parity (`automations`, `automation_runs`, `inbox_items`)
- [x] Inbox/archiving behavior for automation results (persisted run + inbox state)

### 4.3 Settings
- [ ] Settings nav sections
- [ ] Environment CRUD
- [ ] Worktrees management
- [x] Archived threads management (list + per-thread restore; permanent delete remains unsupported by protocol)

### 4.4 UX polish
- [ ] Keyboard shortcuts (match real; don’t show letter hints unless real does)
- [ ] Empty states (no workspaces, no threads, disconnected)
- [ ] Loading states (skeletons / spinners)
- [ ] Accessibility (focus states, escape closes sheets, tab order)

---

## 5) Suggested implementation plan (pragmatic, clone-first)

### Phase 1 — Unblock & match shell (P0)
1. [x] Remove app-server blocking error; show non-blocking banner if backend is down.
2. [x] Rebuild left sidebar to match real IA:
   - [x] top nav icons
   - [x] threads grouped by workspace
3. [x] Replace top bar with real app semantics (thread title/workspace/overflow).
4. [x] Implement New thread home “Let’s build” layout.

### Phase 2 — Core thread experience
1. [x] Message renderer that matches typography + markdown + inline code pills.
2. [x] Agent activity log component (“Ran …”, “Worked for …”).
3. [x] Copy icon + affordances.

### Phase 3 — Automations
1. [x] Templates grid
2. [x] Create automation sheet
3. [ ] Wire up to CLI automation primitives
4. [ ] Implement SQLite persistence parity for automation state and run/inbox records

### Phase 4 — Settings + Git UI
1. [x] Settings internal nav + pages (Environments first)
2. [ ] Git status panel + diff view

---

## Appendix A — Reference frames I used (timecodes)

### Actual app frames
- [ ] ~00:01:00 Thread view (conversation layout)
- [ ] ~00:02:00 Settings → Environments edit
- [ ] ~00:04:00 New thread home (“Let’s build”)
- [ ] ~00:07:00 Automations templates grid (“Beta” badge)
- [ ] ~00:07:30 Create automation sheet (right overlay)
- [ ] ~00:08:30 Thread transcript showing “Ran …” logs + “Worked for …”
- [ ] ~00:09:00 Changes/diff view

### Clone frames
- [ ] ~00:00:00 Sidebar with “Navigation/Recents/Threads”
- [ ] ~00:00:20 “APP‑SERVER UNAVAILABLE” blocking state
- [ ] ~00:01:10 Automations route still blocked by the same error

