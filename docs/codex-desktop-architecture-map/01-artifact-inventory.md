# 01 - Artifact Inventory

## Top-level build footprint

- `src_files=614`
- `vite_build_files=5`
- `webview_assets=497`
- `webview_apps_icons=20`
- `webview_colorcons=90`
- `unminify_safe_src_files=438`
- `tmp_codex_wakaru_files=6361`

## .vite build artifacts

- `src/.vite/build/main.js`
- `src/.vite/build/main-CQwPb0Th.js`
- `src/.vite/build/preload.js`
- `src/.vite/build/worker.js`
- `src/.vite/build/applied-devbox-cache-CkiLfgk8.js`

## Renderer asset distribution (`src/webview/assets`)

- `.js=434`
- `.ttf=20`
- `.woff=20`
- `.woff2=19`
- `.png=2`
- `.css=1`
- `.mjs=1`

## Sourcemap availability status

From `docs/SOURCEMAP_ANALYSIS.md`:

- `scannedFiles=480`
- `sourceMapDirectives=451`
- `copiedMaps=0`
- `inlineMaps=0`
- `missingMaps=451`
- `remoteReferences=0`
- `invalidDataUris=0`

Interpretation: maps are referenced in build output but absent from the distributed package.

## Deep inventory links

- Full submodule root topology: `inventories/00-root-topology.md`
- Full scripts catalog: `inventories/01-scripts-catalog.md`
- Full renderer JS/MJS asset list: `inventories/03-webview-assets-js.md`
- Full unminify-safe JS mirror list: `inventories/05-unminify-safe-js-files.md`
