# Codex Desktop Clone — Gap Analysis & Required Changes (Actual App vs Agent Build)

This document lists **everything I can confirm from the two screen recordings**:

- [ ] **Actual Codex desktop app recording** (`actual-codex-app.mp4`, ~9:15)
- [ ] **Agent-built clone recording** (`codex-desktop-agent.mp4`, ~1:26)

> Note: the clone recording is dominated by an **“APP‑SERVER UNAVAILABLE”** state, so several flows can’t be validated end-to-end from video. Where that happens, I mark the item as **[UNVERIFIED IN CLONE]** and still describe what the real app does (from the actual recording) so you can implement it.

---

## 0) Executive summary (P0 blockers)

### P0 — must fix before “full clone” is even testable
1. [ ] **Remove/repair the “app-server bootstrap” dependency**: the clone UI is effectively non-functional due to a hard error panel (“APP‑SERVER UNAVAILABLE / App‑server bootstrap failed.”). The real app does **not** present this gate during normal use.
2. [ ] **Rebuild left navigation + thread list to match the real app** (information architecture, spacing, typography, grouping, row affordances).
3. [ ] **Match top-bar semantics** (real app: thread title + workspace label + overflow menu; clone: “Run/Open” controls that do not exist in the real app UI shown).
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
- [ ] Empty main canvas with a large **“Let’s build”** headline.
- [ ] A **workspace selector** rendered near the “Let’s build” label (dropdown caret).
- [ ] A large floating/illustrative icon near the headline.

### 1.3 Thread view (real app)
The thread view is a **chat-like transcript**, but *not* “bubble chat”:
- [ ] Assistant output is rendered as markdown: headings, lists, inline code, links.
- [ ] The app includes **execution logs** (e.g., repeated “Ran …” lines for commands) and a compact **“Worked for Xm Ys”** duration indicator.
- [ ] There is a **copy icon** for assistant message content (visible near the bottom of the assistant message block in the actual recording).

### 1.4 Automations (real app)
Automations has:
- [ ] Page title **“Automations”** with a **“Beta”** pill badge.
- [ ] Subtitle: “Automate work by setting up scheduled threads.” with a **Learn more** link.
- [ ] A “Start with a template” section showing **template cards in a grid** (2 columns in the recording), each card with:
  - [ ] A small icon/emoji tile top-left
  - [ ] Title/description copy
  - [ ] Hover/focus affordances
- [ ] Clicking a template opens a **right-side creation sheet** (“Create automation”) containing:
  - [ ] A prominent **red warning callout** about sandbox settings and risk, with inline links (“rules”, etc.).
  - [ ] Fields: **Name**, **Projects** (chip/tokens), **Prompt** (multiline).
  - [ ] The sheet overlays the main page while leaving the left sidebar visible.

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
- [ ] Remove the **“Navigation”** header + “CODEX” wordmark presentation. Replace with the real app’s compact icon+label block.
- [ ] Remove right-aligned shortcut letters (N/A/S) from the sidebar rows (real app doesn’t show them persistently).
- [ ] Replace “RECENTS” section with the real app’s **workspace-grouped thread list**.
- [ ] Implement the real app’s **Threads header row** including the small icon buttons for add/sort/filter.
- [ ] Match sidebar width (~25–30% of window in the recording) and internal spacing.

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
- [ ] Remove **Run/Open** from the primary top bar and align with the real app:
  - [ ] In thread view: show **[Thread title] [Workspace] […]**
  - [ ] In New thread: show minimal header (“New thread”) and keep the emphasis on the “Let’s build” canvas.
  - [ ] Settings/Automations: show the page title only (plus small contextual actions if the real app has them).
- [ ] Ensure the app icon/title in the OS chrome matches the real app (real shows Codex mark; clone shows orange dot).

---

### 2.3 App initialization / backend connectivity (critical)

#### ✅ Real app
- [ ] Opens into working UI without a blocking “app-server bootstrap failed” state in the recording.

#### ❌ Clone
- [ ] Shows blocking panel: **“APP‑SERVER UNAVAILABLE — App-server bootstrap failed.”** with a retry button.

#### Required changes (P0)
- [ ] Rework backend architecture so the UI can render and be usable even if:
  - [ ] the CLI is not found / not configured
  - [ ] the selected workspace has issues
  - [ ] background services are down  
- [ ] Replace “app-server” with a Codex-native model:
  - [ ] Use Tauri/Rust commands (IPC) to call the Codex CLI directly and stream results
  - [ ] Or, if a local server is necessary, embed lifecycle management so it starts reliably and the UI degrades gracefully.
- [ ] Implement a real-app-like empty/error state:
  - [ ] Show a small banner/toast and guidance, **not** a full-page block that prevents navigation.

---

### 2.4 New thread home (“Let’s build”)

#### ✅ Real app
- [ ] Large “Let’s build” text at the lower-right quadrant.
- [ ] Workspace name below with dropdown caret.
- [ ] Minimal rest of the canvas.

#### ❌ Clone
- [ ] Shows “New thread” in top bar with “Pick a workspace” microcopy.
- [ ] Main canvas occupied by the app-server error card.

#### Required changes
- [ ] Implement real layout:
  - [ ] Center/empty canvas
  - [ ] “Let’s build” + workspace dropdown anchored at bottom-right area
  - [ ] Decorative icon near the headline (real app uses a large outline icon)
- [ ] Ensure no blocking system errors cover this surface.

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
  - [ ] expanded workspace folders
  - [ ] scroll position of thread list

---

### 2.6 Thread view content rendering (chat transcript)

#### ✅ Real app
- [ ] Markdown rendering with:
  - [ ] Bulleted lists
  - [ ] Inline code as pill chips (rounded background)
  - [ ] Links in muted blue
- [ ] Execution log lines prefixed by “Ran …” and grouped visually
- [ ] “Worked for Xm Ys” indicator aligned on the right
- [ ] Copy-to-clipboard icon for assistant content

#### ❌ Clone
- [ ] Not observable due to app-server error and no thread content shown.

#### Required changes
- [ ] Implement a message renderer that matches:
  - [ ] Typography scale (real app uses larger body text, generous line height)
  - [ ] Inline code pill style (dark pill with light text)
  - [ ] Code blocks (monospace, subtle background, padding, scroll)
  - [ ] Message spacing (no chat bubbles; full-width blocks)
  - [ ] Copy icon placement and hover behavior
- [ ] Add an “agent activity” subcomponent:
  - [ ] “Ran …” lines rendered in a distinct style
  - [ ] Collapsible grouping for long command logs (recommended)
  - [ ] Duration indicator “Worked for …”

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
- [ ] “Automations” title with **Beta** badge
- [ ] Subtitle and Learn more link
- [ ] Template cards grid with consistent card sizing and icon tile

#### ❌ Clone
- [ ] Navigates to an “Automations” page but content is blocked by app-server error.
- [ ] Sidebar styling differs from real app.

#### Required changes
- [ ] Match the Automations page layout:
  - [ ] Header typography (“Automations” large)
  - [ ] Beta badge size/shape
  - [ ] Template cards: padding, corner radius, hover elevation, icon tile
  - [ ] Two-column responsive grid (in the recording window size)
- [ ] Ensure templates populate even without workspaces (or show a soft empty state explaining requirement).

---

### 2.9 Create automation sheet (modal)

#### ✅ Real app
- [ ] Opens as a **right-side overlay sheet** (“Create automation”)
- [ ] Contains:
  - [ ] Red warning callout about sandbox settings
  - [ ] Name field
  - [ ] Projects chips/tokens
  - [ ] Prompt textarea

#### ❌ Clone
- [ ] Not shown.

#### Required changes
- [ ] Implement a right-side sheet component with:
  - [ ] Rounded corners and shadow
  - [ ] Scrollable internal content
  - [ ] Escape key to close, click-outside to close
  - [ ] Focus trap for accessibility
- [ ] Implement form components that visually match real app:
  - [ ] Text input styling
  - [ ] Chip/tokens with remove “x”
  - [ ] Multiline prompt box
  - [ ] Primary/secondary actions (not visible in frame; ensure there is a save/create CTA consistent with real app)

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
- [ ] Environments page supports selecting and editing an environment.

#### ❌ Clone
- [ ] A “Settings” title exists but appears to be the same error canvas.

#### Required changes
- [ ] Implement Settings as a first-class route with internal nav.
- [ ] Match nav typography, spacing, and active state.
- [ ] Implement at minimum:
  - [ ] Environments list
  - [ ] Environment edit view (name, paths, etc.)
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
- [ ] Thread transcript rendering (markdown + logs + copy)
- [ ] Git status panel + diff viewer

### 4.2 Automations
- [ ] Templates page
- [ ] Create automation sheet
- [ ] Scheduling + background execution on worktrees
- [ ] Inbox/archiving behavior for automation results

### 4.3 Settings
- [ ] Settings nav sections
- [ ] Environment CRUD
- [ ] Worktrees management
- [ ] Archived threads management

### 4.4 UX polish
- [ ] Keyboard shortcuts (match real; don’t show letter hints unless real does)
- [ ] Empty states (no workspaces, no threads, disconnected)
- [ ] Loading states (skeletons / spinners)
- [ ] Accessibility (focus states, escape closes sheets, tab order)

---

## 5) Suggested implementation plan (pragmatic, clone-first)

### Phase 1 — Unblock & match shell (P0)
1. [ ] Remove app-server blocking error; show non-blocking banner if backend is down.
2. [ ] Rebuild left sidebar to match real IA:
   - [ ] top nav icons
   - [ ] threads grouped by workspace
3. [ ] Replace top bar with real app semantics (thread title/workspace/overflow).
4. [ ] Implement New thread home “Let’s build” layout.

### Phase 2 — Core thread experience
1. [ ] Message renderer that matches typography + markdown + inline code pills.
2. [ ] Agent activity log component (“Ran …”, “Worked for …”).
3. [ ] Copy icon + affordances.

### Phase 3 — Automations
1. [ ] Templates grid
2. [ ] Create automation sheet
3. [ ] Wire up to CLI automation primitives

### Phase 4 — Settings + Git UI
1. [ ] Settings internal nav + pages (Environments first)
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

