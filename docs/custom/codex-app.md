# Codex-style Desktop App — Complete UI/UX + Feature Spec (Markdown)

This spec consolidates everything observable from the demo UI notes and the accompanying UX analyses, and turns it into a buildable feature list + interaction blueprint. :contentReference[oaicite:0]{index=0}

---

## 0) Product concept and “what the app is”
### Core idea
A desktop app where the primary “unit of work” is a **Thread** (a task conversation) that can **run agentic work in the background**, across **multiple workspaces/repos**, with **reviewable code changes**, and **built-in workflows** for committing/pushing/PR creation. :contentReference[oaicite:1]{index=1} :contentReference[oaicite:2]{index=2}

This app is a **command center for agents**: users can pair with one coding agent for targeted edits or supervise coordinated sets of agents across the full software lifecycle (design, build, ship, maintain).

### Experience pillars
- **Manager-style workflow**: you orchestrate work and review diffs rather than living in an editor. :contentReference[oaicite:3]{index=3}  
- **Parallelization**: multiple threads can be active/running without blocking. :contentReference[oaicite:4]{index=4}  
- **Unified history/config with CLI** (shared context + continuity). :contentReference[oaicite:5]{index=5} :contentReference[oaicite:6]{index=6}  
- **Project-scoped orchestration**: agents run in separate, project-organized threads so users can switch tasks without context loss.
- **Long-running task support**: agent runs can be substantial (hours/days/weeks), so progress, resumability, and supervision UX are first-class.
- **Scale supervision over raw generation**: the primary UX problem is directing/collaborating with multiple capable agents at scale, not just single-turn code generation.

---

## 1) Global window chrome and layout grid
### Primary layout (default)
- **Left sidebar**: fixed width ~240px. [Added] :contentReference[oaicite:7]{index=7}  
- **Main content**: center column; scrollable thread view. [Added] :contentReference[oaicite:8]{index=8}  
- **Right panel (conditional)**: persistent **Diff/Review panel** (not a modal) that docks as a third column when reviewing changes. [Added] :contentReference[oaicite:9]{index=9} :contentReference[oaicite:10]{index=10}  

### Window feel
- Demo notes call out a native, polished desktop look (macOS vibrancy/blur in the original). If you’re cloning on Windows, replicate this with:
  - blurred/translucent surfaces where possible (app shell + sidebar background) [Added]
  - subtle shadows, thin borders, and consistent rounded corners [Added] :contentReference[oaicite:11]{index=11}  

---

## 2) Top bar (main content header row)
A single horizontal toolbar aligned to the top of the main pane. :contentReference[oaicite:12]{index=12}

### Left side
- **Thread title** (bold) + **workspace/project label** (lighter) inline. [Added] :contentReference[oaicite:13]{index=13}  
- **Overflow menu (“…”)** near the title. [Added] :contentReference[oaicite:14]{index=14}  

### Right side (primary actions)
- **Run/Resume control**: a play triangle button with a small dropdown chevron. [Added] :contentReference[oaicite:15]{index=15}  
- **Open** button with dropdown chevron (used for opening project/files externally, or opening in editor). [Added] :contentReference[oaicite:16]{index=16} :contentReference[oaicite:17]{index=17}  
- **Contextual primary action (changes by state)**:
  - In worktree workflow: **Checkout on local** and **Create branch here** appear as primary actions. [Added] :contentReference[oaicite:18]{index=18} :contentReference[oaicite:19]{index=19}  
  - In commit workflow: **Commit** appears with a dropdown chevron. [Added] :contentReference[oaicite:20]{index=20}  
- **Diffstat chip** on the far right (example: `+718 -303`). [Added] :contentReference[oaicite:21]{index=21}  
- **Share/copy style icon** at extreme right (overlapping squares look). [Added] :contentReference[oaicite:22]{index=22}  

---

## 3) Left sidebar (information architecture + exact sections)
### Primary nav (always at top, in this order)
1. **New thread** [Added]
2. **Automations** [Added]
3. **Skills** [Added] :contentReference[oaicite:23]{index=23}  

### Recents / pinned list
Each row shows:
- Title (left) [Added]
- Relative time (right): `3d`, `2d`, `9h`, `51m`, etc. [Added]
- Some entries show a **blue dot** indicator (unread/updated/attention). [Added] :contentReference[oaicite:24]{index=24} :contentReference[oaicite:25]{index=25}  

### Threads section (workspace grouping)
- Label: **Threads** [Added]
- Two tiny control icons on the right of the label (one “new/open”, one “filter/sort”). [Added] :contentReference[oaicite:26]{index=26}  
- Under Threads: list of workspace/repos with folder icon (examples include recipe-app, photobooth, developers-website, wanderlust, etc.). [Added] :contentReference[oaicite:27]{index=27}  
- Threads are organized by **project/workspace** and optimized for parallel supervision across many active tasks.

### Active/selected thread row behavior
- Selected row has a light gray highlight bar [Added]
- Can show truncated title, diffstat (`+77 -2`), relative time (`2m`), and a small running indicator (dot/spinner). [Added] :contentReference[oaicite:28]{index=28}  

---

## 4) “New Thread” empty state + starter prompt cards
### Empty state center layout
- Small cloud logo glyph [Added]
- Header: **“Let’s build”** [Added]
- Workspace label beneath (e.g., photobooth) with dropdown caret (workspace picker). [Added] :contentReference[oaicite:29]{index=29}  

### Starter prompt cards (one-click seeds)
A row of rounded cards above the composer, including:
- “Create a classic snake game” [Added]
- “Find and fix bugs in my code” [Added]
- “Summarize this app in a $pdf” [Added]
Plus a subtle **“Explore more”** link. [Added] :contentReference[oaicite:30]{index=30}  

**Behavior**
- Clicking a card pre-fills the composer with that prompt (editable before sending). [Added] :contentReference[oaicite:31]{index=31}  

---

## 5) Composer (bottom input): controls, states, and behaviors
### Visual container
- A single large **rounded rectangle** docked at the bottom of the main pane. [Added] :contentReference[oaicite:32]{index=32}  

### Placeholder + “power user” affordances
- Placeholder guidance references:
  - `@` to add files [Added]
  - `/` for commands [Added] :contentReference[oaicite:33]{index=33}  

### Bottom row controls (inside composer)
**Left cluster**
- **“+” attach** button [Added] :contentReference[oaicite:34]{index=34}  
- Optional **Agent dropdown** appears in some contexts (sits between + and model). [Added] :contentReference[oaicite:35]{index=35}  
- **Model dropdown** (example shown: `GPT-5.2-Codex`) [Added] :contentReference[oaicite:36]{index=36}  
- **Effort dropdown** (example shown: `Extra high`) [Added] :contentReference[oaicite:37]{index=37}  

**Right cluster**
- **Lock icon** (context lock / “don’t modify” style control). [Added] :contentReference[oaicite:38]{index=38}  
- **Send button**: circular dark button with up-arrow icon inside. [Added] :contentReference[oaicite:39]{index=39}  

### Below-composer baseline row (environment + context)
**Left**
- Mode tabs: **Local | Worktree | Cloud** [Added] :contentReference[oaicite:40]{index=40}  

**Right**
- Workspace selector: **gear icon + workspace name** with dropdown caret [Added] :contentReference[oaicite:41]{index=41}  
- Branch/base selector: **branch icon + “From main”** with dropdown caret [Added] :contentReference[oaicite:42]{index=42}  

### Run-in-progress state (critical)
When a run is active:
- Send button becomes **Stop** (square icon inside the circle). [Added] :contentReference[oaicite:43]{index=43}  
- A bottom-right **progress indicator** appears:
  - circular progress ring + percent label (e.g., `10%`, `42%`) [Added]
  - next to it: active branch/worktree name (truncated). [Added] :contentReference[oaicite:44]{index=44} :contentReference[oaicite:45]{index=45}  

---

## 6) Thread view: timeline, summary, undo, and “Review changes”
### User request bubble
- The user’s prompt appears as a rounded pill bubble near the top right of the content column. [Added] :contentReference[oaicite:46]{index=46}  

### Timeline event list (progressive disclosure)
- Vertical list of compact events; each line is one action with a trailing chevron `>` (click to open detail). [Added] :contentReference[oaicite:47]{index=47} :contentReference[oaicite:48]{index=48}  
- Examples:
  - “Explored 1 file, 4 searches, 1 list”
  - “Edited page.tsx +58 -0”
- Edited rows display green additions and red deletions inline. [Added]
- File names are blue links. [Added] :contentReference[oaicite:49]{index=49}  

### Post-run explanation block
After timeline:
- prose explanation of what changed [Added]
- “Files touched” list with linked files [Added]
- optional “Next steps” [Added]
- an explicit footer like **“Tests not run (per instruction).”** [Added] :contentReference[oaicite:50]{index=50}  

### “Files changed” card + undo
- A rounded card summarizes change count and file path + diffstat [Added]
- Right side has an **Undo** action with curved arrow icon. [Added] :contentReference[oaicite:51]{index=51}  

### Bottom sticky “Review changes” affordance
When there are changes:
- A sticky bar above the composer shows:
  - Left: “1 file changed +77 -2” [Added]
  - Right: **“Review changes →”** button [Added] :contentReference[oaicite:52]{index=52}  

Clicking “Review changes” opens the right-side Diff/Review panel. [Added] :contentReference[oaicite:53]{index=53}  

### Collaboration actions from thread
- User can review generated changes in-thread, add comments on diffs, and open files/project in their external editor for manual edits.
- Manual edits and agent edits should coexist without losing thread state or review context.

---

## 7) Diff/Review panel (right column): staging + commenting + bulk actions
### Panel header
- Title: **“Uncommitted changes”** with dropdown caret (scope switcher). [Added] :contentReference[oaicite:54]{index=54}  
- Tabs/pills with counts:
  - **Unstaged · 20** [Added]
  - **Staged · 1** [Added] :contentReference[oaicite:55]{index=55}  
- Also includes:
  - folder icon button (open in tree) [Added]
  - overflow “…” [Added] :contentReference[oaicite:56]{index=56}  

### Per-file diff sections
Each file section includes:
- path + diffstat (e.g., `app/api/generate/route.ts +1 -1`) [Added] :contentReference[oaicite:57]{index=57}  
- collapsible line: “99 unmodified lines” [Added] :contentReference[oaicite:58]{index=58}  
- gutter line numbers + colored edge highlight [Added] :contentReference[oaicite:59]{index=59}  

### Inline hunk controls
Near the right edge of a diff hunk:
- undo/revert arrow [Added]
- plus icon (stage hunk / add comment, depending on mode) [Added] :contentReference[oaicite:60]{index=60}  

### Bottom panel bulk actions
Visible at bottom of the right panel:
- **Revert all** [Added]
- **Stage all** [Added] :contentReference[oaicite:61]{index=61}  

### PR review commenting UI (same panel)
- Inline comment box overlay:
  - placeholder: **“Request change”** [Added]
  - buttons: Cancel, Comment [Added] :contentReference[oaicite:62]{index=62}  
This establishes the panel as both a local diff reviewer *and* PR review surface. :contentReference[oaicite:63]{index=63}  

---

## 8) Worktree workflow (parallel work in same repo)
### Concept + expectation
Worktrees allow parallel work on the same repository by creating a separate directory copy so the agent can change files without disrupting your main working directory. :contentReference[oaicite:64]{index=64}  

Official behavior expectation: each agent operates on an isolated copy to avoid cross-agent conflicts; users can inspect/check out changes locally or let the agent continue without mutating their current local git state.

**User-perspective improvement target**
The analysis notes that syncing/merging worktree changes back can feel clunky; design your clone to make merging “shadow branches” seamless. :contentReference[oaicite:65]{index=65}  

### Entering worktree mode
- User selects **Worktree** in the environment tabs. [Added] :contentReference[oaicite:66]{index=66}  
- Branch/base becomes explicitly **“From main ▼”**. [Added] :contentReference[oaicite:67]{index=67}  

### Creating worktree modal (terminal-like progress)
A modal appears:
- Title: “Creating worktree” [Added]
- Description: “Creating a worktree and running setup.” [Added]
- Terminal-like output (monospace), with steps such as: [Added]
  - preparing worktree (detached HEAD)
  - worktree created at a path
  - running setup script
  - running `pnpm install`
  - completion lines like “found 0 vulnerabilities” :contentReference[oaicite:68]{index=68}  

Modal actions include:
- “Work locally instead” [Added]
- “Cancel” [Added] :contentReference[oaicite:69]{index=69}  

### After creation: top-bar actions appear
In worktree context, primary actions include:
- **Checkout on local** [Added]
- **Create branch here** [Added] :contentReference[oaicite:70]{index=70} :contentReference[oaicite:71]{index=71}  

---

## 9) Branch creation modal (worktree → branch)
Modal copy includes:
- “A branch will be created and checked out in this worktree.” [Added]
- “Once created, you should do your work from this directory.” [Added]
- “You cannot checkout this branch on your local repo.” [Added]
- Field: Branch name (pre-filled) [Added]
- Optional “Set prefix” [Added]
- Buttons: Continue, Close [Added] :contentReference[oaicite:72]{index=72}  

---

## 10) Commit flow (modal) + autogenerated commit messages
### Commit entry points
- Top bar shows **Commit** with dropdown chevron in commit workflow state. [Added] :contentReference[oaicite:73]{index=73}  
- Diff panel itself supports staging/unstaging and bulk actions, implying commit is the next step after review. [Added] :contentReference[oaicite:74]{index=74} :contentReference[oaicite:75]{index=75}  

### “Commit your changes” modal (exact fields)
- Title: “Commit your changes” [Added]
- Branch: (truncated branch ref) [Added]
- Changes: “1 files” and diffstat [Added]
- Toggle: Include unstaged [Added]
- Commit message textarea with placeholder: [Added]
  - **“Leave blank and codex will generate a commit message for you.”** [Added] :contentReference[oaicite:76]{index=76} :contentReference[oaicite:77]{index=77}  

### Next steps options (radio list)
- Commit [Added]
- Commit and push [Added]
- Commit and create PR [Added] :contentReference[oaicite:78]{index=78}  

Primary button: **Continue** [Added] :contentReference[oaicite:79]{index=79}  

---

## 11) PR creation progress modal (step checklist)
After selecting “Commit and create PR”:
- Modal title: **“Creating a PR”** [Added]
- Subtext: "Creating a PR from your worktree branch." [Added]
- Step checklist with status icons (spinner/check). [Added]
- Checklist items: Committed, Pushed, Creating PR. [Added]
- Optional log output area (monospace). [Added]
- Close button. [Added]

---

## 12) Skills: beyond code generation (official copy clarifications)
### Product requirement
Codex app must support skills as first-class runtime capabilities, not just static prompt snippets.

The app should include a built-in skills library for common workflows, with compatibility for the open source skills ecosystem (`https://github.com/openai/skills`).
Skills should support non-coding outcomes as first-class tasks (research/synthesis, problem-solving, writing, and operational workflows), not only code generation.

### Skill model
- A skill bundles instructions, resources, and scripts so agents can connect to tools and execute repeatable workflows reliably.
- Skill selection supports both:
  - explicit invocation (user asks for specific skill(s))
  - automatic routing (app/agent selects skills based on task intent)

### Skills UX requirements
- Dedicated Skills area must support:
  - browsing installed/recommended skills
  - creating and editing skills
  - enabling/disabling skills per task context (global or workspace-scoped policy)
- Skill usage should be visible in thread activity (which skill was used and for what step), including failures and retry state.
- Skills created in the app must be available cross-surface (desktop app, CLI, IDE extension).
- Users can check skills into a repository so the same skills are available to the whole team via team config conventions.

### Baseline skill categories to validate
- Design implementation from Figma context/assets.
- Project management integration (e.g., Linear-style triage/release workflows).
- Cloud deployment workflows (e.g., Cloudflare/Netlify/Render/Vercel patterns).
- Image generation/editing workflows (GPT Image-style skill behavior).
- OpenAI API build workflows that rely on current docs/context.
- Document workflows (PDF, spreadsheets, DOCX read/create/edit).

### Acceptance criteria
- Skills can run end-to-end in agent tasks without manual command scaffolding by the user.
- Skill execution artifacts/logs are inspectable in-thread.
- Skill configuration survives restarts and is shared consistently with CLI/IDE session context where applicable.
- A newly created skill in the app is invokable from CLI and IDE extension without redefinition.
- Repo-checked-in skills can be discovered and used by teammates in the same project config.

---

## 13) Cross-surface continuity (CLI + IDE extension)
### Requirement
Desktop app startup should pick up prior Codex session history and configuration from CLI and IDE extension usage so users can continue immediately in existing projects.

### Acceptance criteria
- Existing projects/threads become available without manual re-import.
- Shared auth/session/config state behaves consistently across CLI, IDE extension, and desktop app.
- When shared state is unavailable/corrupt, app degrades gracefully with actionable recovery messaging (no hard lockout).

---

## 14) Scale and supervision requirements (from official positioning)
- Multi-agent operation is a core path, not an edge case.
- The app should support supervising many concurrent threads with clear status, ownership, and interruption controls.
- Long-running tasks must remain transparent:
  - current step/status
  - resumable progress
  - durable logs and artifacts
- System should tolerate very large, multi-step runs and surface self-validation actions performed by agents (for example, testing/QA verification loops).
- The UX should optimize for delegation/review loops rather than single-shot code generation.

---

## 15) Automations (delegated recurring work)
### Product requirement
Automations run Codex work in the background on a user-defined schedule.

### Execution model
- An automation combines instructions with optional skills.
- Automations execute on schedule without manual thread kickoff each run.
- When an automation finishes, output is delivered to a review queue/inbox so the user can inspect, approve, and continue work.
- Automation runtime state is persisted in SQLite (official app behavior), inspectable via `uvx datasette ~/.codex/sqlite/codex-dev.db`.

### Persistence model (official app)
SQLite database path:
- `~/.codex/sqlite/codex-dev.db`

Observed tables and fields:
- `automations`: `id`, `name`, `prompt`, `status`, `next_run_at`, `last_run_at`, `cwds`, `rrule`, `created_at`, `updated_at`
- `automation_runs`: `thread_id`, `automation_id`, `status`, `read_at`, `thread_title`, `source_cwd`, `inbox_title`, `inbox_summary`, `created_at`, `updated_at`, `archived_user_message`, `archived_assistant_message`, `archived_reason`
- `inbox_items`: `id`, `title`, `description`, `thread_id`, `read_at`, `created_at`

### Automation UX requirements
- Automation creation/edit flow must include:
  - name
  - schedule
  - target project/workspace
  - prompt/instructions
  - optional skills attachment
- Each run should expose status, logs, and produced artifacts with links back to the originating thread context.
- Failed runs should surface actionable retry options and last known failure reason.

### Representative automation use cases to support
- Daily issue triage.
- CI failure detection and summarization.
- Daily release brief generation.
- Recurring bug checks/regression scans.

### Acceptance criteria
- Automations can run unattended and land results in a review queue.
- Users can continue from automation results in normal thread workflow without copy/paste context transfer.
- Optional skills in automation definitions are applied during execution.
- UI automation lists/details reconcile with SQLite-backed state (`status`, `next_run_at`, `last_run_at`, `read_at`) and not just transient in-memory state.
- Inbox/review queue behavior maps to persisted `inbox_items` and `automation_runs` records.

---

## 16) Personality controls
### Product requirement
Support two interaction personalities with identical capabilities:
- terse/pragmatic
- conversational/empathetic

### Control surface
- Personality can be switched with `/personality` in app, CLI, and IDE extension.
- Personality selection should persist as shared user preference where cross-surface settings are synchronized.

### Acceptance criteria
- Personality affects response style only, not tool access, permissions, model quality, or completion capabilities.
- Switching personality in one surface is reflected consistently in other connected Codex surfaces.

---

## 17) Security and sandboxing
### Product requirement
Security is integrated by default using native, open source, configurable system-level sandboxing aligned with Codex CLI behavior.

### Default policy
- Agents are restricted to editing files within the active folder/branch scope.
- Agents can use cached web search under default policy.
- Elevated operations (for example unrestricted network access) require explicit permission unless policy rules allow them.

### Policy configurability
- Project/team rules can allow specific commands to run with elevated permissions automatically.
- Permission events and policy-applied elevations must be auditable in thread/run logs.

### Acceptance criteria
- Secure defaults are active on first run without extra setup.
- Policy overrides are explicit, reviewable, and scoped (project/team/user as configured).
- Elevated command execution path is transparent to users and reversible through settings/config.

---

## 18) Platform and roadmap alignment notes
- Continue improving multi-agent flow ergonomics based on real-world feedback, especially context-preserving switches across active agents.
- Extend Automations with cloud-based triggers so background execution can continue when the local machine is not open.
- Keep platform support and performance roadmap visible in product planning (including Windows availability expansion and faster inference improvements).
- Provide clear in-app links to setup and usage docs so users can onboard to app features quickly.
