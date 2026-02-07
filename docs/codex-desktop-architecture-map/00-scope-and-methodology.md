# 00 - Scope And Methodology

## Source set analyzed

- `third_party/CodexDesktop-Rebuild/src/.vite/build/*`
- `third_party/CodexDesktop-Rebuild/src/webview/index.html`
- `third_party/CodexDesktop-Rebuild/src/webview/assets/*`
- `third_party/CodexDesktop-Rebuild/scripts/*`
- `third_party/CodexDesktop-Rebuild/docs/SOURCEMAP_ANALYSIS.md`
- `third_party/CodexDesktop-Rebuild/docs/unfinished-signal-parity-map.md`
- `third_party/CodexDesktop-Rebuild/tmp/codex-wakaru/unminify-safe/...`

## Constraints

- Sourcemaps are referenced but not shipped.
- Remaining files were not additionally unminified.
- Architecture statements are derived from shipped bundle behavior and script wiring.

## Extraction method

- Static string extraction from main/renderer bundles.
- Focused line-window inspection around key registration blocks.
- Inventory generation for handlers/events/routes/chunks.
- Cross-check against debug harness scripts and fixture behavior.

## Confidence model

- High confidence: direct extracted constants, switch cases, API keys, and script behavior.
- Medium confidence: behavior inferred from minified renderer control flow where source symbols are lossy.
- Explicitly marked gaps: areas requiring runtime replay or missing source maps.
