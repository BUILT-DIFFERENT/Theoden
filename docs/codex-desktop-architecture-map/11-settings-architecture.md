# 11 - Settings Architecture

## Settings section slugs observed

- `general-settings`
- `agent`
- `personalization`
- `mcp-settings`
- `skills-settings`
- `git-settings`
- `local-environments`
- `worktrees`
- `data-controls`
- `open-source-licenses`

## Lazy chunk mapping

See `appendices/settings-lazy-chunks.md`.

Chunk split confirms route-level code loading for major settings pages.

## Navigation model

Settings sidebar drives route replacement under `/settings/:section/*` and supports host-specific fallback behavior for sections unavailable in specific build flavors.
