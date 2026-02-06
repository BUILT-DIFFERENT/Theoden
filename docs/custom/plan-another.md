# Codex CLI Clone — UI/UX Gap Analysis + Implementation Checklist (Target: “Codex” Desktop App UI)

> **Context**
> You provided:
> - **Current clone build screenshots** (app title “Codex Command Center”) showing: New thread, Automations, Skills, Skills w/ Terminal panel, Settings.
> - **Target reference screenshots** (zip) showing the **real Codex desktop app UI** (“Codex”) including: left rail + thread grouping, “Start with a task” grid, diff panel, git actions (commit/push/PR), terminal toggle, status bar (Local + permissions + branch), settings subsections (General/MCP/Git/Environments/Archived), account/org dropdown, @-file picker, etc.

This document enumerates **everything that needs to change** to make the clone match the target UI/behavior.  
All tasks are actionable, written in developer/implementation language, and are checklisted.

---

## 0) Critical Functional Bugs (Current Clone)
- [ ] **Wire up workspace selection**: “Pick a workspace” currently does nothing. Implement real workspace state (selected workspace, persistence, reload) and propagate to threads/git/diff/terminal context.
- [ ] **Fix all no-op controls**: top-bar buttons (Run/Open/Git/Terminal), “Add workspace”, nav items, and any dropdown triggers must dispatch actual actions (route changes, modal open, API call).
- [ ] **Implement routing/state machine**: current UI appears mostly static. Replace placeholder click handlers with real navigation + store-driven rendering.

---

## 1) App Shell / Window Chrome / Global Layout (Target vs Current)
### Target UI (from zip)
- Native app name: **“Codex”** (not “Codex Command Center”).
- Uses **native menubar** (File/Edit/View/Window/Help) with actions like:
  - File → New Thread (Ctrl+N), Open Folder (Ctrl+O), Settings (Ctrl+,), About, Exit
- Layout is a **3-region shell**:
  1) **Left rail**: main nav + thread groups + org/account controls
  2) **Main content**: thread view or start grid or settings
  3) Optional **right diff panel**: uncommitted changes, file tree, staging, inline diffs

### Required changes
- [ ] Rename branding/window title to match target (“Codex”) and align app icon usage.
- [ ] Implement **native menu** bindings (Electron/Tauri/etc):
  - [ ] File menu items + keyboard accelerators (Ctrl+N/Ctrl+O/Ctrl+,)
  - [ ] Edit menu items (Undo/Redo/Cut/Copy/Paste/Select All)
  - [ ] About modal and Exit wiring
- [ ] Replace current “Command Center” blurred-card aesthetic with target’s **flatter dark UI**:
  - [ ] Reduce heavy gaussian blur backdrops; use subtle translucency + low-contrast panels.
  - [ ] Normalize spacing/typography to target (smaller headings, tighter padding, less “hero card” feel).

---

## 2) Left Navigation Rail + Threads List (Major Gap)
### Target behavior/components
- Left rail includes:
  - Primary nav: **New thread / Automations / Skills** (icon + label)
  - Section header **Threads** with controls:
    - “Organize” popover (By project vs Chronological)
    - “Sort by” (Created vs Updated)
    - “Show” (All threads vs Relevant)
  - Thread groups displayed as **project folders** (e.g. Handy, Theoden, kotlin-lsp…)
  - Each thread row shows truncated title + relative time (e.g. 2d, 3h)
  - Bottom-left **Settings** link
  - Bottom-left **account/org dropdown** (email + org name + links + logout)

### Current clone status
- Left rail shows “Recents / Threads / Providers” but:
  - No real workspaces/projects loaded (“No workspaces detected”)
  - Missing thread grouping + sorting/filter controls
  - “Providers” chip row does not exist in target rail

### Required changes
- [ ] Rebuild left rail to match target information architecture:
  - [ ] Replace “Recents/Providers” sections with **Threads** grouping + account/org UI.
  - [ ] Add **Threads header action buttons** (organize/sort/filter popover).
  - [ ] Implement **project-folder grouping** UI (expand/collapse groups).
  - [ ] Render **thread rows** with (title, timestamp, active highlight).
- [ ] Implement account/org dropdown:
  - [ ] Dropdown shows current email + org/workspace name
  - [ ] Items: Settings, OS Settings shortcut, Documentation links (platform-dependent), Logout
  - [ ] Selected option states (checkmark) + external-link icon where applicable

---

## 3) “New thread” / Empty State / Start Grid (Current Clone is Wrong)
### Target: “Start with a task”
- Header: **Start with a task** with a small dropdown caret for category switching.
- Grid of rounded cards with icon + one-liner prompt:
  - Sections like **Get started**, **Skills**, **Automations**
- Bottom composer is visible and consistent (not a giant hero).
- In some contexts, **diff panel can appear even on New thread** (uncommitted changes shown on right).

### Current clone
- Shows giant hero “Let’s build” + 3 cards only (Snake / Fix bugs / Summarize app).
- Doesn’t match target layout, spacing, or card catalog content.

### Required changes
- [ ] Replace New thread screen with target’s “Start with a task” layout:
  - [ ] Implement category dropdown (caret next to title).
  - [ ] Implement multi-row grid with consistent card sizing (icon top-left, text below).
  - [ ] Add section
