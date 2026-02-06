import type { ThreadDetail, ThreadMessage, ThreadSummary } from "@/app/types";

const THREAD_LIST_CACHE_KEY = "codex.thread.list.cache.v1";
const THREAD_DETAIL_CACHE_KEY = "codex.thread.detail.cache.v1";
const MAX_CACHED_THREADS = 200;
const MAX_CACHED_THREAD_DETAILS = 50;

interface CachedThreadDetail {
  thread: ThreadDetail;
  messages: ThreadMessage[];
  cachedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function canUseStorage() {
  return typeof window !== "undefined";
}

function readJson<T>(key: string): T | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Failed to read ${key}`, error);
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to persist ${key}`, error);
  }
}

function toThreadSummary(value: unknown): ThreadSummary | null {
  if (!isRecord(value)) return null;
  const { id, title, subtitle, projectId, lastUpdated, status } = value;
  if (typeof id !== "string") return null;
  if (typeof title !== "string") return null;
  if (typeof subtitle !== "string") return null;
  if (typeof projectId !== "string") return null;
  if (typeof lastUpdated !== "string") return null;
  if (
    status !== "queued" &&
    status !== "running" &&
    status !== "needs_review" &&
    status !== "done" &&
    status !== "failed"
  ) {
    return null;
  }
  return {
    id,
    title,
    subtitle,
    projectId,
    lastUpdated,
    status,
    changeSummary: value.changeSummary as ThreadSummary["changeSummary"],
    modelProvider:
      typeof value.modelProvider === "string" ? value.modelProvider : undefined,
    source: typeof value.source === "string" ? value.source : undefined,
  };
}

function toCachedThreadDetail(value: unknown): CachedThreadDetail | null {
  if (!isRecord(value)) return null;
  if (!isRecord(value.thread)) return null;
  if (typeof value.thread.id !== "string") return null;
  if (!Array.isArray(value.messages)) return null;
  if (typeof value.cachedAt !== "number") return null;
  return {
    thread: value.thread as unknown as ThreadDetail,
    messages: value.messages as ThreadMessage[],
    cachedAt: value.cachedAt,
  };
}

export function loadCachedThreadSummaries() {
  const parsed = readJson<unknown>(THREAD_LIST_CACHE_KEY);
  if (!Array.isArray(parsed)) {
    return [] as ThreadSummary[];
  }
  return parsed
    .map(toThreadSummary)
    .filter((entry): entry is ThreadSummary => Boolean(entry));
}

export function storeCachedThreadSummaries(threads: ThreadSummary[]) {
  const dedupedById = new Map<string, ThreadSummary>();
  threads.forEach((thread) => {
    dedupedById.set(thread.id, thread);
  });
  writeJson(
    THREAD_LIST_CACHE_KEY,
    Array.from(dedupedById.values()).slice(0, MAX_CACHED_THREADS),
  );
}

export function loadCachedThreadDetail(threadId: string) {
  const parsed = readJson<Record<string, unknown>>(THREAD_DETAIL_CACHE_KEY);
  if (!parsed || !isRecord(parsed)) {
    return null;
  }
  const cached = toCachedThreadDetail(parsed[threadId]);
  if (!cached) {
    return null;
  }
  return cached;
}

export function storeCachedThreadDetail(
  threadId: string,
  snapshot: Pick<CachedThreadDetail, "thread" | "messages">,
) {
  const parsed = readJson<Record<string, unknown>>(THREAD_DETAIL_CACHE_KEY);
  const cache = isRecord(parsed) ? { ...parsed } : {};
  cache[threadId] = {
    thread: snapshot.thread,
    messages: snapshot.messages,
    cachedAt: Date.now(),
  } satisfies CachedThreadDetail;

  const entries = Object.entries(cache)
    .map(([key, value]) => [key, toCachedThreadDetail(value)] as const)
    .filter((entry): entry is readonly [string, CachedThreadDetail] =>
      Boolean(entry[1]),
    )
    .sort((a, b) => b[1].cachedAt - a[1].cachedAt)
    .slice(0, MAX_CACHED_THREAD_DETAILS);
  writeJson(THREAD_DETAIL_CACHE_KEY, Object.fromEntries(entries));
}
