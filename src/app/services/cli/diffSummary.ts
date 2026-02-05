import {
  getArray,
  getObject,
  getString,
  isRecord,
} from "@/app/services/cli/appServerPayload";
import type { DiffFile, DiffSummary } from "@/app/types";

export function diffStatsFromText(diffText?: string) {
  if (!diffText) return { additions: 0, deletions: 0 };
  let additions = 0;
  let deletions = 0;
  diffText.split(/\r?\n/).forEach((line) => {
    if (line.startsWith("+++") || line.startsWith("---")) return;
    if (line.startsWith("+")) additions += 1;
    if (line.startsWith("-")) deletions += 1;
  });
  return { additions, deletions };
}

export function diffStatsFromChanges(changes?: unknown[]) {
  if (!changes?.length) return { additions: 0, deletions: 0 };
  const summary = summarizeChanges(changes);
  return { additions: summary.additions, deletions: summary.deletions };
}

export function summarizeChanges(changes: unknown[]): DiffSummary {
  const fileMap = new Map<string, DiffFile>();
  changes.forEach((change) => {
    if (!isRecord(change)) return;
    const path = getString(change, "path");
    if (!path) return;
    const diff = getString(change, "diff");
    const kind = getObject(change, "kind");
    const kindType = kind ? getString(kind, "type") : undefined;
    const status =
      kindType === "add"
        ? "added"
        : kindType === "delete"
          ? "deleted"
          : "modified";
    const { additions, deletions } = diffStatsFromText(diff);

    const existing = fileMap.get(path);
    if (existing) {
      existing.additions += additions;
      existing.deletions += deletions;
      existing.status = mergeStatus(existing.status, status);
      return;
    }

    fileMap.set(path, {
      path,
      additions,
      deletions,
      status,
    });
  });
  return summaryFromMap(fileMap);
}

export function summarizeTurns(turns: unknown[]): DiffSummary {
  const fileMap = new Map<string, DiffFile>();
  turns.forEach((turn) => {
    if (!isRecord(turn)) return;
    const items = getArray(turn, "items") ?? [];
    items.forEach((item) => {
      if (!isRecord(item)) return;
      if (getString(item, "type") !== "fileChange") return;
      const changes = getArray(item, "changes") ?? [];
      applyChangesToMap(fileMap, changes);
    });
  });
  return summaryFromMap(fileMap);
}

export function diffTextFromTurns(turns: unknown[]): string {
  const chunks: string[] = [];
  turns.forEach((turn) => {
    if (!isRecord(turn)) return;
    const items = getArray(turn, "items") ?? [];
    items.forEach((item) => {
      if (!isRecord(item)) return;
      if (getString(item, "type") !== "fileChange") return;
      const changes = getArray(item, "changes") ?? [];
      changes.forEach((change) => {
        if (!isRecord(change)) return;
        const diff = getString(change, "diff");
        if (!diff) return;
        chunks.push(diff.trim());
      });
    });
  });
  return chunks.filter(Boolean).join("\n\n");
}

function applyChangesToMap(map: Map<string, DiffFile>, changes: unknown[]) {
  changes.forEach((change) => {
    if (!isRecord(change)) return;
    const path = getString(change, "path");
    if (!path) return;
    const diff = getString(change, "diff");
    const kind = getObject(change, "kind");
    const kindType = kind ? getString(kind, "type") : undefined;
    const status =
      kindType === "add"
        ? "added"
        : kindType === "delete"
          ? "deleted"
          : "modified";
    const { additions, deletions } = diffStatsFromText(diff);

    const existing = map.get(path);
    if (existing) {
      existing.additions += additions;
      existing.deletions += deletions;
      existing.status = mergeStatus(existing.status, status);
      return;
    }

    map.set(path, {
      path,
      additions,
      deletions,
      status,
    });
  });
}

function mergeStatus(current: DiffFile["status"], next: DiffFile["status"]) {
  if (current === "deleted" || next === "deleted") return "deleted";
  if (current === "added" || next === "added") return "added";
  return "modified";
}

function summaryFromMap(map: Map<string, DiffFile>): DiffSummary {
  let additions = 0;
  let deletions = 0;
  const files = Array.from(map.values());
  files.forEach((file) => {
    additions += file.additions;
    deletions += file.deletions;
  });
  return {
    filesChanged: map.size,
    additions,
    deletions,
    files,
  };
}
