# Codex CLI (Command Center) UI Parity Spec + Gap List (Target vs Current Clone)

This doc enumerates **all known UI + interaction gaps** between the **current clone** (agent-built app) and the **target Codex UI** (per the reference video + screenshot pack). It’s written as an implementation checklist with developer-facing language and explicit behavior requirements.

---

## 0) Global “Stop the Bleeding” Functional Gaps (currently broken)

- [x] **Workspace selection is non-functional**: Fixed by normalizing selection updates, persisting selected workspace/workspace list in local storage for desktop + web mode, and auto-resolving selection from the available workspace set.
- [ ] **Buttons are no-ops** across the app (top toolbar buttons, “Add workspace”, “New automation”, “View details”, “Download”, etc.). Wire all onClick handlers and route transitions.
- [ ] Add an **interaction audit harness**:
  - [ ] log/telemetry for button clicks + route changes in dev mode
  - [ ] a temporary “UI smoke test” mode that highlights any clickable element without a handler

---

## 1) App Shell / Window Chrome Parity

### 1.1 Branding + titlebar/menu parity
**Target**
- Desktop app title is **“Codex”** (not “Codex Command Center”).
- On Windows: has a top menu row **File / Edit / View / Window / Help**.
- On macOS: uses native window chrome (traffic lights); “Help” menu contains deep links (Docs, Automations, Local Environments, Worktrees, Skills, MCP, Troubleshooting, Trace Recording, Keyboard shortcuts).

**Current clone**
- Custom titlebar + toolbar only; no native menu structure; branding mismatch.

**Tasks**
- [ ] Rename app + all window titles to **Codex**.
- [ ] Implement **native app menu**:
  - [ ] Windows top menu row (File/Edit/View/Window/Help)
  - [ ] macOS application menu entries mirroring target
- [ ] Help menu items:
  - [ ] Codex documentation
  - [ ] Automations
  - [ ] Local Environments
  - [ ] Worktrees
  - [ ] Skills
  - [ ] Model Context Protocol
  - [ ] Troubleshooting
  - [ ] Start Trace Recording
  - [ ] Keyboard shortcuts

### 1.2 Layout scaffolding + regions
**Target**
- 3 primary regions:
  1) **Left sidebar**: nav + threads/projects
  2) **Main content**: landing, thread view, settings, etc.
  3) Optional **right panel**: diffs / file changes / context
- Optional **bottom terminal drawer** toggled by shortcut + toolbar button.

**Current clone**
- Sidebar sections don’t match target (Recents/Providers present; Threads empty).
- Terminal UI exists visually in one screenshot but is not a first-class toggleable drawer.

**Tasks**
- [ ] Normalize shell layout to match target region model.
- [ ] Remove/replace non-target sidebar sections (**Recents**, **Providers**) unless they exist in target mode.
- [ ] Implement a real **bottom terminal drawer** with resize + persistence.

---

## 2) Left Sidebar (Navigation + Threads/Projects) Parity

### 2.1 Primary navigation
**Target**
- “New thread”, “Automations”, “Skills” entries:
  - [ ] icons
  - [ ] consistent spacing + hover states
  - [ ] keyboard shortcuts (e.g., N/A/S shown in UI)

**Current clone**
- Similar items exist but styling/spacing leading/trailing glyphs don’t match.

**Tasks**
- [ ] Match icon set, alignment, typography, and shortcut badges to target.
- [ ] Implement shortcut routing:
  - [ ] `N` → New thread
  - [ ] `A` → Automations
  - [ ] `S` → Skills

### 2.2 Threads/projects section (major gap)
**Target**
- A “Threads” section that is **not empty** once a project/workspace exists.
- Supports:
  - [ ] project/workspace grouping with folder icon (e.g., “Handy”, “recipe-app”, etc.)
  - [ ] thread rows with truncation + relative timestamps (e.g., `4d`, `2d`, `32m`)
  - [ ] selected/active row highlight
  - [ ] per-section actions in header (e.g., “new thread” icon, filter/sort icon)
  - [ ] scrollable list with proper scrollbars

**Current clone**
- Shows “No workspaces detected.” No project grouping, no real thread entities, no timestamps.

**Tasks**
- [ ] Implement data model:
  - [ ] `Project` (workspace) entity with path + displayName + provider type
  - [ ] `Thread` entity with title + updatedAt + projectId + status flags
- [ ] Implement sidebar rendering:
  - [ ] projects grouped under “Threads”
  - [ ] thread row timestamp rendering + truncation
  - [ ] selected row + hover/active states
- [ ] Implement header actions:
  - [ ] “New thread” (contextual to selected project)
  - [ ] filter/sort popover (see target)
- [ ] Persist projects + threads to local storage (or sqlite) and restore on launch.

### 2.3 Bottom-left account/org entry
**Target**
- Bottom-left shows org/account (“OpenAI” or org name). Clicking opens menu with:
  - [ ] Settings
  - [ ] platform docs entries (OS-specific)
  - [ ] logout

**Current clone**
- Missing account/org footer entry and menu.

**Tasks**
- [ ] Add org/account footer button.
- [ ] Add popover menu:
  - [ ] Settings
  - [ ] OS docs links
  - [ ] Logout

---

## 3) Top Toolbar Parity (Open / Git Actions / Terminal / Counters)

### 3.1 “Open” destination dropdown
**Target**
- “Open” button with dropdown.
- Dropdown includes “Open in” list with app targets + icons (platform-dependent):
  - [ ] VS Code (Windows) / Antigravity/Finder/Terminal/Ghostty/Xcode/Android Studio (macOS examples)
  - [ ] “Copy Path” action at bottom
- Visual style: rounded popover, separators, hover row highlight.

**Current clone**
- “Open” exists but doesn’t open menu / no destination list / no Copy Path.

**Tasks**
- [ ] Implement Open dropdown + platform-specific targets.
- [ ] Implement Copy Path (clipboard) for active project/worktree path.
- [ ] Ensure button shows current default open destination icon.

### 3.2 Git actions dropdown (Commit / Push / Create PR)
**Target**
- Git actions dropdown with:
  - [ ] Commit
  - [ ] Push
  - [ ] Create PR
- Items enable/disable based on repo state + auth.
- Shows “Next steps” flow if GitHub CLI not authenticated (e.g., `gh auth login`).

**Current clone**
- Git dropdown exists but no actions and no enable/disable logic.

**Tasks**
- [ ] Implement git state plumbing:
  - [ ] detect repo, branch, dirty state, ahead/behind counts
- [ ] Implement Git actions dropdown + disabled states.
- [ ] Implement “Next steps” modal/stepper for auth prerequisites.
- [ ] Wire “Create PR” to GitHub flow (at minimum: open PR URL or spawn CLI).

### 3.3 Diff counters + staging affordances
**Target**
- Shows change counters in toolbar (e.g., `+22,243 -36`), updated live.

**Current clone**
- Shows `+0 -0` statically; not tied to repo.

**Tasks**
- [ ] Compute added/removed lines from `git diff --numstat` / `--shortstat`.
- [ ] Update counters reactively when worktree changes.

### 3.4 Terminal toggle button + tooltip
**Target**
- Toolbar icon toggles terminal drawer.
- Tooltip includes shortcut: **Ctrl/Cmd+J**.

**Current clone**
- Terminal button exists in some views but doesn’t toggle anything.

**Tasks**
- [ ] Wire terminal toggle to actual drawer.
- [ ] Add tooltip + shortcut hint.
- [ ] Implement **Ctrl/Cmd+J** handler globally.

---

## 4) Bottom Bar Parity (“Continue in” / Permissions / Branch)

### 4.1 Environment/work mode selection (target uses dropdown, not tabs)
**Target**
- Bottom bar includes:
  - [ ] “Continue in” dropdown with options like:
    - Local project
    - New worktree
    - Connect Codex web
    - Send to cloud
  - [ ] Permission dropdown (“Default permission”, “Full access”, etc.)
  - [ ] Branch dropdown (`main` with icon)

**Current clone**
- Uses **Local/Worktree/Cloud tabs** duplicated in layout; missing “Continue in” semantics; missing permissions dropdown.

**Tasks**
- [ ] Replace tabs with **single “Continue in” dropdown** matching target.
- [ ] Implement permission dropdown + enforce permission gating:
  - [ ] file read/write access
  - [ ] command execution access
  - [ ] elevated network access (if applicable)
- [ ] Implement branch dropdown and switching (or stub with state + no-op warning).

---

## 5) New Thread Landing Screen(s) Parity

### 5.1 “No project/workspace” onboarding state
**Target**
- Dedicated onboarding screen:
  - “Select a project”
  - explanatory subtext
  - primary CTA “Add project”
  - secondary “Skip”

**Current clone**
- Shows “Let’s build” landing but “Add workspace” doesn’t work; no real onboarding flow.

**Tasks**
- [ ] Implement onboarding screen exactly (copy, spacing, button styles).
- [ ] “Add project” opens folder picker and registers project.
- [ ] Persist added project; transition to populated sidebar state.

### 5.2 “Let’s build” state (project selected)
**Target**
- Centered icon + “Let’s build”
- Shows selected project/workspace name with dropdown
- Suggestion cards row (3) + “Explore more”
- Composer at bottom

**Current clone**
- Similar but mismatched:
  - wrong workspace control (ADD WORKSPACE button vs workspace dropdown label)
  - missing populated threads in sidebar
  - missing bottom bar semantics (“Continue in”, permissions)
  - card spacing/iconography differs

**Tasks**
- [ ] Replace “ADD WORKSPACE” with **workspace name + dropdown** (when selected).
- [ ] Ensure “Explore more” placement and typography matches target.
- [ ] Match card radius, shadow, icon placement, and copy line breaks.

### 5.3 “Start with a task” state (expanded task catalog)
**Target**
- A “Start with a task” header with dropdown caret
- Multi-row grid of task cards (not just 3)
- Scrolling behavior for long catalog
- Each card has:
  - [ ] emoji/icon in top-left
  - [ ] short description
  - [ ] consistent card sizing + gutters

**Current clone**
- Only 3 cards.

**Tasks**
- [ ] Implement task catalog grid + virtualization (optional) for smooth scroll.
- [ ] Implement “Start with a task” dropdown (switch task sets/templates).
- [ ] Ensure responsive behavior (window resize changes columns).

---

## 6) Composer Parity (Input, Controls, Mentions, Commands)

### 6.1 Visual structure
**Target**
- Large rounded composer with:
  - placeholder: “Ask Codex anything, @ to add files, / for commands”
  - bottom control row:
    - [ ] “+” attach
    - [ ] model dropdown (e.g., GPT-5.3-Codex)
    - [ ] reasoning/effort dropdown (High, Extra High)
    - [ ] mic icon
    - [ ] send button (circular with up-arrow)
- Setting can toggle **compact composer controls**.

**Current clone**
- Similar container exists but controls differ (lock icon shown; “Agent: Default” control present; layout differs).
- No mention overlays / slash commands.

**Tasks**
- [ ] Match exact control set + ordering to target per mode:
  - [ ] Non-agent composer baseline (no “Agent: Default” unless target supports it)
  - [ ] Model + effort dropdowns
  - [ ] Mic + send button styling
- [ ] Implement compact composer mode toggle (Settings → “Use compact composer controls”).

### 6.2 `@` file mention picker (major missing behavior)
**Target**
- Typing `@` opens an overlay list of files (with icons + paths) anchored above composer.
- Supports:
  - [ ] incremental search
  - [ ] keyboard navigation
  - [ ] scroll inside overlay
  - [ ] insertion of selected file reference into prompt

**Current clone**
- No file picker overlay.

**Tasks**
- [ ] Implement file indexer for selected project/worktree.
- [ ] Implement anchored `@` overlay with:
  - [ ] file icon
  - [ ] filename + relative path
  - [ ] highlight active row
- [ ] Enter/Tab selects; Esc closes.

### 6.3 `/` command picker
**Target**
- Typing `/` opens a command list (actions like run, open, commit, etc.) anchored above composer.

**Current clone**
- No command overlay.

**Tasks**
- [ ] Implement slash-command registry + overlay UI.
- [ ] Wire commands to real actions (or explicit “Not implemented” toast in dev).

---

## 7) Terminal Drawer Parity

**Target**
- Bottom drawer labeled “Terminal” / “Workspace shell”
- Shows command transcript, statuses (e.g., “Workspace ready.” “Working tree clean.”)
- Scrollable output, monospace, copyable.
- Toggle via toolbar + Ctrl/Cmd+J.

**Current clone**
- Terminal appears in one screenshot but not consistently; likely static UI.

**Tasks**
- [ ] Implement terminal process management (pty) per workspace/worktree.
- [ ] Render streaming stdout/stderr with line wrapping + ANSI color support.
- [ ] Add:
  - [ ] clear output
  - [ ] copy selection
  - [ ] persistent history per thread/workspace (optional but target-like)

---

## 8) Thread View + Right Panel (Diff/Changes) Parity (currently missing)

### 8.1 Thread view layout
**Target**
- Center column displays assistant messages with structured sections.
- Supports embedded “What’s in place now / Next steps / Key file updated” blocks.
- Composer remains anchored at bottom.

**Current clone**
- No real thread content view shown; likely unimplemented.

**Tasks**
- [ ] Implement thread route:
  - [ ] `/thread/:id` renders conversation history
  - [ ] markdown rendering + code blocks + inline pills/links
- [ ] Implement tool output cards (tests, commands, notes).

### 8.2 Right panel: uncommitted changes + diff viewer
**Target**
- Right panel shows:
  - [ ] “Uncommitted changes”
  - [ ] file list with modified indicators
  - [ ] staging controls (Stage all / Revert all)
  - [ ] per-file diff viewer with green/red highlights
  - [ ] per-file header actions (undo, stage, collapse caret)
- Staging controls appear as a pill overlay in diff view.

**Current clone**
- No right panel / no diffs / no staging controls.

**Tasks**
- [ ] Implement right panel layout + splitter (resizable).
- [ ] Implement diff rendering:
  - [ ] unified diff with syntax highlighting
  - [ ] added/removed line gutters
- [ ] Implement staging UX:
  - [ ] stage/unstage file
  - [ ] stage all / revert all
  - [ ] reflect state in Git actions enablement

---

## 9) Worktrees + “Creating worktree” Progress Screen

**Target**
- When “New worktree” selected, app shows a dedicated progress view:
  - [ ] “Creating worktree” header
  - [ ] explanatory subtext
  - [ ] live log output (worktree path, setup scripts, installs)
  - [ ] actions: “Work locally instead” + “Cancel”

**Current clone**
- No worktree creation flow.

**Tasks**
- [ ] Implement worktree creation pipeline:
  - [ ] `git worktree add …`
  - [ ] run setup script hooks (if present)
  - [ ] stream logs into UI
- [ ] Implement Cancel and fallback to local.

---

## 10) Automations Page Parity

**Target**
- “Let’s automate” header + description (“Schedule recurring runs, spawn new threads, and reuse prompt templates.”)
- “New automation” CTA
- When empty: “No automations yet.”
- Supports creating automations with schedules and prompt templates.

**Current clone**
- Static empty state matches roughly; actions do nothing.

**Tasks**
- [ ] Implement `Automations` route and data model:
  - [ ] Automation entity: name, schedule, template, enabled, lastRun, nextRun
- [ ] Implement “New automation” flow:
  - [ ] modal to select template
  - [ ] schedule picker (cron/rrule UI)
  - [ ] save + list rendering
- [ ] Implement run-now + enable/disable toggles.

---

## 11) Skills Page Parity (List + Detail Modal + Install/Try)

### 11.1 Skills list
**Target**
- “Skills” header + “Learn more”
- Search input
- Buttons: “New skill”, refresh icon, overflow menu
- Sections:
  - [ ] Installed (with “Installed” badge)
  - [ ] Recommended catalog (vendor labels like “OpenAI Labs”, “Community”)

**Current clone**
- Basic layout exists, but missing:
  - list completeness and metadata
  - working buttons
  - detail modal behavior

**Tasks**
- [ ] Implement skill registry:
  - [ ] installed skills list
  - [ ] remote catalog list
- [ ] Implement search filtering.
- [ ] Implement refresh to re-sync catalog.

### 11.2 Skill detail modal
**Target**
- Clicking a skill opens a modal containing:
  - [ ] title + description
  - [ ] longform instructions (markdown)
  - [ ] scrollable content
  - footer actions:
    - [ ] Uninstall (if installed)
    - [ ] Open (source/docs)
    - [ ] Try (execute skill)

**Current clone**
- “View details” likely no-op; modal missing.

**Tasks**
- [ ] Implement modal UI with blur/backdrop + close affordance.
- [ ] Wire “Try” to run skill in current thread/workspace context.
- [ ] Implement install/uninstall flows:
  - [ ] Download → install → “Installed” badge update
  - [ ] Uninstall removes from registry

---

## 12) Settings Parity (Major missing depth)

**Target**
- Settings has left sub-nav:
  - [ ] General
  - [ ] Configuration
  - [ ] Personalization
  - [ ] MCP servers
  - [ ] Skills
  - [ ] Git
  - [ ] Environments
  - [ ] Worktrees
  - [ ] Archived threads
- General contains:
  - [ ] Theme selector (System)
  - [ ] Default open destination (VS Code)
  - [ ] Follow-up behavior (“Append in current thread”)
  - [ ] “Use compact composer controls”
  - [ ] Save button
- Other settings pages are populated (not placeholders).

**Current clone**
- Only General is partially present; other sections likely empty/no routes.

**Tasks**
- [ ] Implement settings router + persistence layer.
- [ ] Build each settings page (even if minimal initially):
  - [ ] Configuration: workspace defaults, indexing behavior
  - [ ] Personalization: tone/persona settings if applicable
  - [ ] MCP servers: server list + add/edit/remove
  - [ ] Skills: skill paths, dev mode installs
  - [ ] Git: auth status, default remote, PR provider
  - [ ] Environments: local env list, add/remove
  - [ ] Worktrees: cleanup policies, naming patterns
  - [ ] Archived threads: list + restore/delete
- [ ] Ensure “Save” actually writes and rehydrates on restart.

---

## 13) Pixel/Style Parity Requirements (don’t hand-wave)

**Must match target**
- [ ] Typography scale + weights (headers vs body vs captions)
- [ ] Card radii (task cards, popovers, composer, modals)
- [ ] Shadows/blur (Mica-like translucency)
- [ ] Spacing grid (consistent 8px/12px/16px gutters)
- [ ] Hover/active/focus states for:
  - [ ] sidebar rows
  - [ ] task cards
  - [ ] dropdown items
  - [ ] icon buttons
- [ ] Scrollbar styling + placement (sidebar, main, right panel, terminal)
- [ ] Iconography set consistency (no mixed icon packs)

**Implementation tasks**
- [ ] Centralize design tokens:
  - [ ] color palette (dark + light)
  - [ ] elevations
  - [ ] radii
  - [ ] typography scale
- [ ] Add a “visual regression” harness:
  - [ ] screenshot tests for each canonical screen state
  - [ ] per-platform snapshots (win/mac)

---

## 14) State/Behavior Parity (Thread/workspace-aware everything)

- [ ] Selecting a project/workspace updates:
  - [ ] sidebar active project group
  - [ ] Open/Commit actions target that workspace
  - [ ] terminal session context
  - [ ] file index for `@` mentions
- [ ] Creating a new thread binds to current workspace + mode (“Local project” vs “Worktree”, etc.)
- [ ] All top-level pages are routable and bookmarkable:
  - [ ] /new
  - [ ] /thread/:id
  - [ ] /automations
  - [ ] /skills
  - [ ] /settings/:section

---

## 15) QA Acceptance Checklist

- [ ] **Workspace selection works end-to-end** (add → select → persists → affects UI).
- [ ] **Every visible button does something** (no dead clicks).
- [ ] Terminal toggle works (button + shortcut).
- [ ] Open dropdown shows targets + Copy Path.
- [ ] Git dropdown shows actions with correct enabled/disabled states.
- [ ] Skills: View details opens modal; Download installs; Try executes.
- [ ] Automations: New automation opens flow; saved automation appears in list.
- [ ] Settings: all sections navigate; values persist after restart.
- [ ] Visual parity: side-by-side comparison passes for each canonical screen.

---
