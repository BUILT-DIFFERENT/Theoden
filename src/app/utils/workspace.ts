export function normalizeWorkspacePath(path: string) {
  return path.trim().replace(/[\\/]+$/, "");
}

export function workspaceNameFromPath(path: string) {
  const normalized = normalizeWorkspacePath(path);
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? normalized;
}
