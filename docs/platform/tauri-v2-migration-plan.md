# Tauri v1 -> v2 Migration + Lint/Optimization Plan (Concrete)

This plan assumes **desktop-only** targets and **Tauri-only** dependency updates. It includes concrete examples, file paths, and validation commands.

## Stage 1 — Inventory & Baseline

- [ ] Record current Tauri v1 usage
  - Files: `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/src/main.rs`, `src/app/services/cli/*.ts`
- [ ] Inventory Tauri JS API imports and potential plugins
  - Search for `@tauri-apps/api/*` usage and map to v2 `@tauri-apps/api/core` or plugins.
- [ ] Inventory CI/release environment variables
  - Look for `TAURI_PRIVATE_KEY`, `TAURI_KEY_PASSWORD`, `TAURI_DEV_SERVER_PORT`.
- [ ] Confirm dev server port consistency
  - Example: Vite uses `1420` in `vite.config.ts`, so Tauri `build.devUrl` should be `http://localhost:1420`.
- [ ] Capture lint/build baseline
  - `pnpm lint`
  - `pnpm format:app`
  - `pnpm frontend:build`

## Stage 2 — Automated Migration (CLI)

- [ ] Bump CLI to v2 in `package.json`
  - Example: `"@tauri-apps/cli": "^2"`
- [ ] Run migration
  - `pnpm desktop:cli migrate`
- [ ] Commit resulting config changes (baseline)

## Stage 3 — Tauri Config (Manual Reshape)

Update `src-tauri/tauri.conf.json` from v1 → v2 shape.

### v1 Example (Current)

```json
{
  "build": {
    "beforeBuildCommand": "pnpm frontend:build",
    "beforeDevCommand": "pnpm frontend:dev",
    "devPath": "http://localhost:1420",
    "distDir": "../dist"
  },
  "package": {
    "productName": "Codex Command Center",
    "version": "0.1.0"
  },
  "tauri": {
    "allowlist": {
      "all": true
    },
    "windows": [
      {
        "title": "Codex Command Center",
        "width": 1400,
        "height": 900
      }
    ]
  }
}
```

### v2 Example (Target)

```json
{
  "$schema": "./gen/schemas/desktop-schema.json",
  "productName": "Codex Command Center",
  "version": "0.1.0",
  "identifier": "com.example.codexcommandcenter",
  "mainBinaryName": "codex-command-center",
  "build": {
    "beforeBuildCommand": "pnpm frontend:build",
    "beforeDevCommand": "pnpm frontend:dev",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Codex Command Center",
        "width": 1400,
        "height": 900
      }
    ],
    "security": {
      "capabilities": ["default"]
    }
  },
  "bundle": {
    "active": true,
    "targets": "all"
  }
}
```

- [ ] Move `package.productName` → top-level `productName`.
- [ ] Move `package.version` → top-level `version`.
- [ ] Add `identifier` and `mainBinaryName`.
- [ ] Rename `build.devPath` → `build.devUrl`.
- [ ] Rename `build.distDir` → `build.frontendDist`.
- [ ] Replace `tauri.windows` → `app.windows`.
- [ ] Replace `tauri.allowlist` → `app.security.capabilities`.
- [ ] If present, move `tauri.bundle` → top-level `bundle`.
- [ ] If present, move `tauri.systemTray` → `app.trayIcon`.

## Stage 4 — Capabilities (Replace Allowlist)

Create `src-tauri/capabilities/default.json`.

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default permissions for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:event:default"
  ]
}
```

- [ ] Ensure `core:default` is present.
- [ ] Add `core:event:default` if backend emits events (current code does).
- [ ] Add more permissions only as needed.
- [ ] If using `tauri migrate`, review generated capability files for least-privilege.
- [ ] If coming from v2 beta, ensure all core permissions include the `core:` prefix.

## Stage 5 — Rust Backend Migration

### Cargo.toml

Update `src-tauri/Cargo.toml`:

```toml
[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
```

- [ ] Remove `features = ["api-all"]`.
- [ ] Remove deprecated v1 features if present (`system-tray`, `updater`, etc.).

### Event Emission API

Replace `emit_all` with `emit` in `src-tauri/src/main.rs`:

```rust
use tauri::Emitter;

app_handle.emit("app-server-notification", message)?;
```

- [ ] Replace all `emit_all(...)` calls with `emit(...)`.
- [ ] Add `use tauri::Emitter;`.
- [ ] If you need targeted delivery, use `emit_to(...)` instead of `emit(...)`.

### Plugin Registration (if needed)

If v1 APIs were used (dialogs, fs, shell, etc.), add plugins in `src-tauri/src/main.rs`:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

### Async Lock Contention Fix

Current pattern holds a lock across a second `.await`. Refactor in `app_server_start`:

```rust
let stdin = {
    let mut child_guard = state.child.lock().await;
    if child_guard.is_some() {
        return Ok(());
    }
    // spawn child, take stdin, drop lock before awaiting another lock
    let stdin = child.stdin.take().ok_or("failed to capture app-server stdin")?;
    *child_guard = Some(child);
    stdin
};

*state.stdin.lock().await = Some(stdin);
```

- [ ] Avoid holding `child` lock while awaiting `state.stdin` lock.

## Stage 6 — Frontend JS API Migration

### Update Tauri imports (v2)

Replace v1 imports:

```ts
import { invoke } from "@tauri-apps/api/tauri";
```

with v2:

```ts
import { invoke } from "@tauri-apps/api/core";
```

- [ ] `src/app/services/cli/runner.ts`
- [ ] `src/app/services/cli/appServer.ts`

### API Package Renames (Scan + Replace)

- [ ] `@tauri-apps/api/window` → `@tauri-apps/api/webviewWindow`
- [ ] Any non-core API → plugin packages (see below)

### Plugin Package Mapping (if used)

- [ ] `@tauri-apps/api/dialog` → `@tauri-apps/plugin-dialog`
- [ ] `@tauri-apps/api/fs` → `@tauri-apps/plugin-fs`
- [ ] `@tauri-apps/api/shell` → `@tauri-apps/plugin-shell`
- [ ] `@tauri-apps/api/notification` → `@tauri-apps/plugin-notification`
- [ ] `@tauri-apps/api/http` → `@tauri-apps/plugin-http`
- [ ] `@tauri-apps/api/os` → `@tauri-apps/plugin-os`
- [ ] `@tauri-apps/api/process` → `@tauri-apps/plugin-process`
- [ ] `@tauri-apps/api/clipboard` → `@tauri-apps/plugin-clipboard-manager`
- [ ] `@tauri-apps/api/global-shortcut` → `@tauri-apps/plugin-global-shortcut`
- [ ] `@tauri-apps/api/updater` → `@tauri-apps/plugin-updater`

### Tauri Detection (Type Safe)

Replace `window as any` usage with a typed global:

```ts
declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isTauri() {
  return typeof window !== "undefined" && window.__TAURI_INTERNALS__ !== undefined;
}
```

- [ ] Update `src/app/utils/tauri.ts`.
- [ ] Remove `any` usage in `AppShell.tsx`.

## Stage 7 — Lint Cleanup (Concrete Targets)

- [ ] Replace `any` and unsafe casts:
  - `src/app/services/cli/useAppServerEvents.ts`
  - `src/app/services/cli/useAppServerStream.ts`
  - `src/app/services/cli/eventMapper.ts`
  - `src/app/services/cli/approvals.ts`
- [ ] Define typed event payloads and use `unknown` + type guards where needed.

### ESLint Rules (Optional but Recommended)

Add to `eslint.config.mjs`:

```js
"import/order": ["error", {
  groups: ["builtin", "external", "internal", ["parent", "sibling"], "index", "type"],
  "newlines-between": "always",
  alphabetize: { order: "asc", caseInsensitive: true }
}],
"@typescript-eslint/no-floating-promises": "error",
"@typescript-eslint/await-thenable": "error"
```

- [ ] Normalize import ordering.
- [ ] Prevent dropped async work.

## Stage 8 — Windows Origin + CI Env Vars

- [ ] Windows origin URL change: production now uses `http://tauri.localhost` by default.
  - If preserving IndexedDB/cookies is required, set `useHttpsScheme: true` in `app.windows`.
- [ ] Update CI/release env vars:
  - `TAURI_PRIVATE_KEY` → `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_KEY_PASSWORD` → `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  - `TAURI_DEV_SERVER_PORT` → `TAURI_CLI_PORT`

## Stage 9 — Targeted Optimization (Low-Risk)

- [ ] Route-level code splitting for initial bundle size:
  - Example: lazy-load `ThreadPage` or heavy panels in `src/app/router.tsx`.

```ts
const ThreadPage = lazy(() => import("@/app/routes/ThreadPage"));
```

- [ ] Prefer `initialData` / `placeholderData` over early `isTauri()` branches to keep render paths consistent.

## Stage 10 — Validation

- [ ] Frontend:
  - `pnpm lint`
  - `pnpm format:app`
  - `pnpm frontend:build`
- [ ] Rust:
  - `cargo check` in `src-tauri`
- [ ] Tauri:
  - `pnpm desktop:dev` (smoke test)
  - `pnpm desktop:build` (full build)

## Stage 11 — Docs & Cleanup

- [ ] Update any docs mentioning v1 allowlist or config keys.
- [ ] Document required capabilities in `docs/` if needed.
- [ ] Remove obsolete comments or TODOs.
