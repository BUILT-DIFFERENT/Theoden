# 16 - App-Server, MCP, And Auth

## App-server process lifecycle

Main process class `ElectronAppServerConnection` manages:

- spawn/monitor/stop of codex CLI process
- initialization request (`method: initialize`)
- request/response correlation maps
- internal notification handlers
- fatal error propagation to renderer windows

## CLI command resolution

Resolution order:

1. host config override `codex_cli_command`
2. env override `CODEX_CLI_PATH` or `CUSTOM_CLI_PATH`
3. packaged resource candidates (`resourcesPath`, unpacked path, repo extension fallback)

Spawned args default to:

- `app-server --analytics-default-enabled`

## Key internal methods observed

- `getAuthStatus`
- `skills/list`
- `config/read`
- `configRequirements/read`
- `thread/start`
- `turn/start`
- `turn/interrupt`

## MCP bridge pattern

Renderer emits `mcp-request` / `mcp-notification` / `mcp-response` wrappers.

Host forwards to app-server, tracks request IDs, and returns wrapped responses on the desktop channel.

## Auth token behavior

- Auth status request can include token refresh flag.
- Token cache/promise coalescing is maintained in host connection class.
- Failures are surfaced as host fatal errors if process becomes unavailable.
