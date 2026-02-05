# Commit and PR Flow

## One-click commit

- Commit button in the header.
- Drawer with message, staged diff, and options.
- Option to auto-generate message when left blank.

## Message generation

- Summarize staged diff into a short subject line.
- Include a short list of key files changed.
- Keep deterministic output for repeatability.
- Placeholder text: “Leave blank and Codex will generate a commit message for you.”

## Push and PR

- Option to Commit only.
- Option to Commit and Push.
- Option to Commit and Create PR.

## PR progress modal

- Title: “Creating a PR”.
- Subtitle: “Hold tight, this may take a few moments…”
- Checklist: committed, pushed, creating PR.

## PR creation

- Use `gh` CLI when available.
- Fall back to API integration later.
- Cloud runs should end with a PR link.
