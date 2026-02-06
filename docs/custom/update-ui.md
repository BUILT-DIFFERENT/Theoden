# Codex CLI UI Clone — Gap List + Target UI Spec (Developer-Facing)

This document enumerates **all required UI/UX + functional changes** to bring the current build in parity with the **reference Codex desktop UI** (video + screenshot pack). Language is intentionally technical and implementation-oriented.

---

## 0. Current State (Observed Problems)

### P0 Functional Blockers
- **Workspace selection is non-functional**:
  - “Pick a workspace” / workspace dropdown does not mutate app state.
  - No workspace context propagation to sidebar threads, home header, environment bar, etc.
- **Primary controls are dead**:
  - `Run` / play control is not wired.
  - `Open` dropdown does not open menu nor dispatch any action.
  - Sidebar nav buttons do not change routes/views.
  - Skills/Automations CTAs do not trigger modals/routes.

### P0 UI Parity Issues
- Current app uses a “Command Center” IA (tabs: Control Room / Threads / Skills / Settings) that **does not exist** in the reference product.
- Layout is “dashboard-with-big-cards”; reference UI is **minimal, centered, and content-first** with optional diff panel.

---

## 1. Target App Information Architecture (IA)

### High-level layout (always-on scaffolding)
- **Left Sidebar** (fixed width)
  - Primary nav: New thread, Automations, Skills
  - Recents list
  - Workspaces + threads tree
  - Footer: Settings (and any status/identity elements, if applicable)
- **Main Content Pane** (route-based)
  - Home / New thread (empty state)
  - Thread view (conversation)
  - Automations
  - Skills
  - Settings
- **Right Diff Panel** (conditionally rendered)
  - Displays Git status and diffs (unstaged/staged)
  - Supports file list + hunks + actions
- **Bottom Bar** (global)
  - Environment mode selector: Local / Worktree / Cloud
  - Workspace context control (gear + workspace dropdown)
  - Branch control (“From main” dropdown)
- **Top Bar** (global)
  - Run/play control + optional dropdown
  - Open dropdown (contextual to workspace/path)
  - Git actions (commit/push/create PR) + status indicators
  - Terminal toggle (if implemented)

> ✅ Remove “Command Center” top nav pills entirely. Replace with route-based views driven from sidebar + state.

---

## 2. Canonical State Model (Minimum Required)

### Entities
- `Workspace`
  - `id: string`
  - `name: string`
  - `path: string` (or locator)
  - `lastOpenedAt: number`
- `Thread`
  - `id: string`
  - `workspaceId: string`
  - `title: string`
  - `createdAt: number`
  - `updatedAt: number`
  - `messages: Message[]`
- `Message`
  - `id: string`
  - `role: "user" | "assistant" | "system"`
  - `content: RichContent` (md, code blocks, tool output)
  - `createdAt: number`
- `GitStatus`
  - `workspaceId: string`
  - `branch: string`
  - `aheadBehind: { ahead: number; behind: number }`
  - `unstaged: FileChange[]`
  - `staged: FileChange[]`
- `FileChange`
  - `path: string`
  - `stats: { added: number; removed: number }`
  - `diffHunks: DiffHunk[]` (optional if lazy-loaded)

### Global UI State
- `activeWorkspaceId: string | null`
- `activeRoute: "home" | "thread" | "automations" | "skills" | "settings"`
- `activeThreadId: string | null`
- `isDiffPanelOpen: boolean`
- `environmentMode: "local" | "worktree" | "cloud"`
- `activeModel: string` (e.g. `GPT-5.2-Codex`)
- `qualityPreset: "low" | "medium" | "high" | "extra_high"`
- `composerDraft: string`
- `isTerminalOpen: boolean`

> ✅ Workspace switching MUST be a first-class action that updates **route data + sidebar lists + main header + bottom bar + git status**.

---

## 3. Routing + Navigation Requirements

### Routes
- `/` → Home/New thread (empty state)
- `/t/:threadId` → Thread view
- `/automations` → Automations view
- `/skills` → Skills view
- `/settings/*` → Settings view with left sub-nav

### Sidebar navigation behavior
- Clicking:
  - **New thread** → route `/` and resets main pane to home empty state (but preserves workspace selection)
  - **Automations** → `/automations`
  - **Skills** → `/skills`
  - **Settings** → `/settings/general` (or default subroute)
- Selecting a **workspace**:
  - sets `activeWorkspaceId`
  - refreshes threads list for that workspace
  - updates home header workspace label
  - updates bottom bar workspace label
  - triggers git status fetch for workspace
- Selecting a **thread**:
  - sets `activeThreadId`
  - routes to `/t/:threadId`
  - loads messages

---

## 4. Screen Specs (Target UI)

## 4.1 Home / New Thread (Empty State)

### Layout
- Centered content stack:
  - Codex icon (top)
  - Headline: `Let's build`
  - Workspace dropdown inline: `photobooth ▾` (example)
  - Suggestion cards grid (3 columns)
  - Subtle “Explore more” link
- Bottom composer (global composer region)
  - Placeholder: **“Ask Codex anything, @ to add files, / for commands”**
  - Left controls: `+` attach, model dropdown, quality dropdown
  - Right controls: lock icon, mic icon, send button (circular)

### Workspace picker (inline)
- Click on workspace label opens dropdown:
  - Header: “Select your workspace”
  - List of workspaces with folder icon
  - Current workspace has checkmark
  - Footer row: “Add new workspace”
- Selecting workspace triggers:
  - `dispatch(setActiveWorkspace(workspaceId))`
  - `dispatch(fetchThreads(workspaceId))`
  - `dispatch(fetchGitStatus(workspaceId))`
  - UI updates (header label + sidebar + bottom bar)

### Suggestion cards
- 3-across, consistent card height
- Each card includes:
  - small icon/emoji glyph in corner
  - one-line prompt text
- Clicking card:
  - populates composer draft with prompt OR starts new thread immediately (match reference behavior)
  - if starts thread: creates thread in active workspace then routes to `/t/:id`

---

## 4.2 Thread View (Conversation)

### Header
- Thread title
- Workspace context + overflow menu `…`
- Composer placeholder changes to: **“Ask for follow-up changes”**

### Messages
- Render markdown + code fences + tool outputs
- Preserve typographic hierarchy (headings, lists)
- Code blocks:
  - monospaced
  - copy button per block (optional but recommended)
- Scrolling:
  - virtualize if large
  - autoscroll on new assistant message unless user scrolled up

### Composer
- Supports:
  - `@` file attach (opens file picker / attachments drawer)
  - `/` commands (command palette or inline suggestions)
- Send:
  - `Enter` sends
  - `Shift+Enter` new line

---

## 4.3 Top Bar Controls (Global)

### Required controls
- **Run / Play** button:
  - must dispatch action (even if backend is stubbed)
  - may show dropdown for run modes (if in reference)
- **Open** dropdown:
  - opens menu with open targets (e.g., open in terminal, editor, file explorer)
  - includes “Copy path”
- **Git status chip**:
  - displays ahead/behind `+A -B`
  - click toggles diff panel
- **Terminal toggle**:
  - toggles terminal drawer/panel (if implemented)
  - show tooltip with shortcut (e.g. `⌘J`) if desktop

> ✅ Current “Run / Open / +0-0” UI must become functional and context-aware.

---

## 4.4 Right Diff Panel (Git)

### Structure
- Title: “Uncommitted changes” with dropdown (if multiple views)
- Tabs:
  - `Unstaged (N)`
  - `Staged (N)`
- File list with:
  - file path
  - `+added/-removed` stats
  - click loads diff

### Diff view
- Hunk rendering with:
  - collapsible “unmodified lines”
  - per-hunk controls (stage/unstage, undo)
- Global actions:
  - `Revert all`
  - `Stage all`

### Inline comment / request-change affordance
- Clicking a diff line opens “Request change” input:
  - multiline textarea
  - buttons: `Cancel`, `Comment`
- Submit dispatches annotation event (can be stubbed to local state)

---

## 4.5 Bottom Bar (Environment + Workspace + Branch)

### Environment selector
- Pills: `Local`, `Worktree`, `Cloud`
- Selecting mode updates `environmentMode` and may trigger flows:
  - Worktree: can show “Creating worktree…” progress view
  - Cloud: can show environment selection

### Workspace context control (right side)
- Gear icon + workspace name dropdown (mirrors home picker)
- Must stay in sync with `activeWorkspaceId`

### Branch control
- Dropdown e.g. “From main”
- Selecting branch updates `GitStatus.branch` and refreshes diff/status

---

## 4.6 Automations View (Target)

### Layout
- Title: “Let’s automate”
- Optional description text + “Learn more”
- CTA: `+ New automation`
- List of existing automations (if any)

### New automation modal (required fields)
- `Name`
- `Workspace` picker (folder list)
- `Prompt` textarea
- `Schedule` controls (recurrence + time)
- Actions: `Cancel`, `Create`

> ✅ Current “Threads, runs, and outcomes / Scheduler / Templates” layout is not parity; replace with the above.

---

## 4.7 Skills View (Target)

### Layout
- Title: “Skills”
- Controls:
  - Search input
  - `+ New skill`
  - `Refresh`/reload
- Sections:
  - Installed
  - Recommended (or catalog)

### Skill detail modal
- Title + version + source (Team/Community)
- Documentation panel
- Actions:
  - `Try`
  - `Open`
  - `Uninstall` (if installed)
  - overflow `…`

> ✅ Current “Remote skills catalog” card grid and “Download” buttons may exist, but must be reshaped to match the reference taxonomy + controls.

---

## 4.8 Settings View (Target)

### Left nav categories
- General
- Configuration
- Personalization
- MCP servers
- Skills
- Git
- Environments
- Worktrees
- Archived threads

### Settings content (minimum)
- Theme / appearance (if applicable)
- Default open destination (editor integration)
- Follow-up behavior / thread settings (if applicable)
- Git settings (author, default branch behavior)
- Environment/worktree defaults

> ✅ Implement actual routes + forms; current build has no parity screen.

---

## 5. Required Interaction Wiring (Acceptance Criteria)

### Workspace selection (P0)
- [ ] Workspace dropdown opens from:
  - [x] Home header (“Let’s build {workspace}”)
  - [x] Bottom bar gear dropdown
  - [x] Sidebar workspace list selection
- [ ] Changing workspace updates:
  - [x] sidebar threads list
  - [x] home header label
  - [x] bottom bar label
  - [ ] git status + branch indicator
- [ ] Workspace list supports:
  - [x] checkmark on active
  - [x] “Add new workspace” action (can be stubbed)

### Buttons do something (P0)
- [x] `Run` dispatches `runActiveThread()` or `runWorkspaceTask()`
- [x] `Open` opens a menu and dispatches open actions
- [ ] Sidebar nav changes routes
- [x] Skills/Automations CTAs open modals / routes

### Thread lifecycle (P1)
- [ ] New thread creation in active workspace
- [ ] Thread view renders message list + composer state changes
- [ ] Composer supports sending and appending messages

### Diff panel (P1)
- [ ] Git status displayed in top bar
- [ ] Clicking git indicator toggles diff panel
- [ ] Tabs for staged/unstaged with correct counts

---

## 6. Styling + UI Tokens (Parity Guidance)

### Visual design constraints
- Reference UI is:
  - low-chrome
  - minimal gradients/blur
  - subtle borders and rounded corners
  - tight vertical rhythm
- Remove “big dashboard cards” and heavy blur containers.

### Suggested tokens
- Border radius: 10–14px (cards), 999px (pills)
- Border: 1px subtle (low-contrast)
- Typography:
  - H1 headline large (home “Let’s build”)
  - body medium
  - monospace for code/diffs
- Spacing:
  - consistent 8px grid
  - generous padding for main empty state, but not “giant panels”

---

## 7. Implementation Notes (Engineering)

### State management
- Use a single source of truth for workspace/thread state (e.g., Zustand/Redux).
- Ensure workspace switching is atomic:
  - clear dependent caches (threads, git status) or scope them by workspaceId
  - avoid UI showing mismatched workspace/thread

### Data fetching (can be mocked initially)
- `listWorkspaces()`
- `listThreads(workspaceId)`
- `createThread(workspaceId, seedPrompt?)`
- `fetchThread(threadId)`
- `fetchGitStatus(workspaceId)`
- `fetchDiff(workspaceId, filePath)` (lazy)
- `commitChanges(workspaceId, options)`
- `pushChanges(workspaceId, options)`

### Desktop integration (if Electron)
- `openPathInExplorer(path)`
- `openInEditor(path, editorId)`
- `toggleTerminal()`

> If web-only, these actions can be stubbed (toast + console) until platform hooks exist, but UI must be fully interactive.

---

## 8. QA / Parity Checklist (Ship Gate)

### P0 Gate
- [ ] Workspace picker fully functional (state + UI propagation)
- [ ] All primary buttons dispatch actions and produce visible state change
- [ ] Sidebar nav routes correctly
- [ ] Home layout matches reference hierarchy (centered stack + 3-across cards + composer)

### P1 Gate
- [ ] Thread view exists and works (messages + follow-up composer)
- [ ] Git diff panel exists with staged/unstaged tabs + file list + hunks
- [ ] Bottom bar environment + branch dropdowns are interactive

### P2 Gate
- [ ] Automations: create modal + listing
- [ ] Skills: search + installed/recommended + detail modal
- [ ] Settings: left-nav + core settings forms

---

## Appendix A — Nested code sample (optional)

````ts
// Example action signature (pseudo)
type AppActions = {
  setActiveWorkspace: (id: string) => void;
  fetchThreads: (workspaceId: string) => Promise<void>;
  fetchGitStatus: (workspaceId: string) => Promise<void>;
  toggleDiffPanel: () => void;
  createThread: (workspaceId: string, seed?: string) => Promise<string>; // returns threadId
  navigate: (route: string) => void;
};
