export function normalizeWorkspacePath(path: string) {
  return path.trim().replace(/[\\/]+$/, "");
}

export function workspaceNameFromPath(path: string) {
  const normalized = normalizeWorkspacePath(path);
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? normalized;
}

export function isLikelyWorkspacePath(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return false;
  }

  return (
    /^[a-zA-Z]:[\\/]/.test(trimmedValue) ||
    trimmedValue.startsWith("/") ||
    trimmedValue.startsWith("\\\\")
  );
}

export function resolveWorkspacePath(options: {
  threadSubtitle?: string | null;
  selectedWorkspace?: string | null;
  workspaces?: Array<{ path: string }>;
  fallbackWorkspace?: string | null;
}) {
  const threadWorkspacePath =
    options.threadSubtitle && isLikelyWorkspacePath(options.threadSubtitle)
      ? options.threadSubtitle
      : null;
  return (
    threadWorkspacePath ??
    options.selectedWorkspace ??
    options.workspaces?.[0]?.path ??
    options.fallbackWorkspace ??
    null
  );
}
