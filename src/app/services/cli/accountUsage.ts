import { requestAppServer } from "@/app/services/cli/rpc";

export interface RateLimitWindow {
  usedPercent: number;
  windowDurationMins: number | null;
  resetsAt: number | null;
}

export interface CreditsSnapshot {
  hasCredits: boolean;
  unlimited: boolean;
  balance: string | null;
}

export interface AccountRateLimitSnapshot {
  primary: RateLimitWindow | null;
  secondary: RateLimitWindow | null;
  credits: CreditsSnapshot | null;
  planType: string | null;
}

interface GetAccountRateLimitsResponse {
  rateLimits?: {
    primary?: Partial<RateLimitWindow> | null;
    secondary?: Partial<RateLimitWindow> | null;
    credits?: Partial<CreditsSnapshot> | null;
    planType?: string | null;
  } | null;
}

function normalizeWindow(value: Partial<RateLimitWindow> | null | undefined) {
  if (!value) {
    return null;
  }
  const usedPercent =
    typeof value.usedPercent === "number" && Number.isFinite(value.usedPercent)
      ? Math.min(Math.max(Math.round(value.usedPercent), 0), 100)
      : 0;
  const windowDurationMins =
    typeof value.windowDurationMins === "number" &&
    Number.isFinite(value.windowDurationMins)
      ? value.windowDurationMins
      : null;
  const resetsAt =
    typeof value.resetsAt === "number" && Number.isFinite(value.resetsAt)
      ? value.resetsAt
      : null;
  return {
    usedPercent,
    windowDurationMins,
    resetsAt,
  } satisfies RateLimitWindow;
}

function normalizeCredits(value: Partial<CreditsSnapshot> | null | undefined) {
  if (!value) {
    return null;
  }
  return {
    hasCredits: Boolean(value.hasCredits),
    unlimited: Boolean(value.unlimited),
    balance: typeof value.balance === "string" ? value.balance : null,
  } satisfies CreditsSnapshot;
}

export async function readAccountRateLimits() {
  const result = await requestAppServer<GetAccountRateLimitsResponse>({
    method: "account/rateLimits/read",
  });
  const rateLimits = result?.rateLimits;
  return {
    primary: normalizeWindow(rateLimits?.primary),
    secondary: normalizeWindow(rateLimits?.secondary),
    credits: normalizeCredits(rateLimits?.credits),
    planType:
      typeof rateLimits?.planType === "string" ? rateLimits.planType : null,
  } satisfies AccountRateLimitSnapshot;
}
