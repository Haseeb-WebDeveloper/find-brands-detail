/**
 * The rules behind AI usage: what a call's outcome is, what the provider's rate-limit headers say,
 * and the totals the Usage page shows. Pure, so they're tested without a database.
 *
 * DAYS ARE UTC. Groq's daily limits don't reset at the team's midnight, and a fixed zone
 * keeps the server and the page agreeing on which day a call belongs to.
 */

export type AiOutcome = "answered" | "unusable" | "limit" | "failed";

export type RateLimit = { requestsLeft: number | null; requestsLimit: number | null; headers: Record<string, string> | null };

const int = (value: string | undefined) => {
  const n = value === undefined ? NaN : Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
};

/**
 * Groq sends `x-ratelimit-limit-requests` / `x-ratelimit-remaining-requests` (per day) and the token
 * pair (per minute) on every answer, and `retry-after` on a refusal. All of them are kept as sent;
 * the daily request pair is also read out so the page can show it.
 */
export function rateLimitFrom(headers: Record<string, string> | undefined): RateLimit {
  const kept = Object.fromEntries(Object.entries(headers ?? {}).filter(([k]) => /^x-ratelimit-|^retry-after$/i.test(k)).map(([k, v]) => [k.toLowerCase(), v]));
  if (Object.keys(kept).length === 0) return { requestsLeft: null, requestsLimit: null, headers: null };
  return { requestsLeft: int(kept["x-ratelimit-remaining-requests"]), requestsLimit: int(kept["x-ratelimit-limit-requests"]), headers: kept };
}

/** The response headers on a failed call: on the error itself, or on the last try the SDK retried. */
export function errorHeaders(error: unknown): Record<string, string> | undefined {
  for (let e = error, depth = 0; e && typeof e === "object" && depth < 4; depth++) {
    const headers = (e as { responseHeaders?: Record<string, string> }).responseHeaders;
    if (headers) return headers;
    e = (e as { lastError?: unknown }).lastError ?? (e as { cause?: unknown }).cause;
  }
  return undefined;
}

export const isQuotaError = (message: string) => /quota|rate.?limit|429|resource.?exhausted/i.test(message);

const LIMIT_KINDS: [RegExp, string][] = [
  [/\(TPD\)|tokens per day/i, "tokens per day"],
  [/\(RPD\)|requests per day/i, "requests per day"],
  [/\(TPM\)|tokens per minute/i, "tokens per minute"],
  [/\(RPM\)|requests per minute/i, "requests per minute"],
  [/PerDay/i, "daily quota"],
  [/PerMinute/i, "per-minute quota"],
];

/** Which limit a refusal names ("Rate limit reached … on tokens per day (TPD)"), or null if it doesn't say. */
export function limitKind(error: string | null): string | null {
  if (!error) return null;
  return LIMIT_KINDS.find(([re]) => re.test(error))?.[1] ?? null;
}

export type UsageRow = {
  brandId: string | null;
  brandName: string | null;
  provider: string;
  outcome: string;
  totalTokens: number | null;
  requestsLeft: number | null;
  requestsLimit: number | null;
  error: string | null;
  createdAt: Date;
};

export type KeyDay = {
  /** "2026-10-23", UTC. */
  day: string;
  provider: string;
  calls: number;
  tokens: number;
  limitHits: number;
  /** When the key was first refused that day, and which limit it named. */
  firstLimitAt: string | null;
  firstLimitKind: string | null;
  /** Tokens the key spent that day before its first refusal: its real daily allowance. */
  tokensBeforeLimit: number | null;
  /** The last daily request count the provider reported. */
  requestsLeft: number | null;
  requestsLimit: number | null;
};

export type BrandUsage = { brandId: string; brandName: string; calls: number; tokens: number; limitHits: number; firstAt: string };

export type LimitHit = { at: string; provider: string; kind: string | null; brandName: string | null };

export type UsageSummary = {
  keyDays: KeyDay[];
  brands: BrandUsage[];
  /** Over brands that had at least one answer; null until one has. */
  perBrand: { brands: number; tokens: number; calls: number } | null;
  limitHits: LimitHit[];
};

const utcDay = (d: Date) => d.toISOString().slice(0, 10);

/** Rows in any order; key-days and brands come back newest first. */
export function summarizeUsage(rows: UsageRow[], { recentHits = 20 } = {}): UsageSummary {
  const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const days = new Map<string, KeyDay>();
  const brands = new Map<string, BrandUsage & { answered: boolean }>();
  const hits: LimitHit[] = [];

  for (const r of sorted) {
    const tokens = r.totalTokens ?? 0;
    const limited = r.outcome === "limit";
    const key = `${utcDay(r.createdAt)}|${r.provider}`;
    const day = days.get(key) ?? {
      day: utcDay(r.createdAt),
      provider: r.provider,
      calls: 0,
      tokens: 0,
      limitHits: 0,
      firstLimitAt: null,
      firstLimitKind: null,
      tokensBeforeLimit: null,
      requestsLeft: null,
      requestsLimit: null,
    };
    day.calls += 1;
    day.tokens += tokens;
    if (r.requestsLeft !== null) day.requestsLeft = r.requestsLeft;
    if (r.requestsLimit !== null) day.requestsLimit = r.requestsLimit;
    if (limited) {
      day.limitHits += 1;
      if (!day.firstLimitAt) {
        day.firstLimitAt = r.createdAt.toISOString();
        day.firstLimitKind = limitKind(r.error);
        day.tokensBeforeLimit = day.tokens;
      }
      hits.push({ at: r.createdAt.toISOString(), provider: r.provider, kind: limitKind(r.error), brandName: r.brandName });
    }
    days.set(key, day);

    if (r.brandId) {
      const brand = brands.get(r.brandId) ?? {
        brandId: r.brandId,
        brandName: r.brandName ?? "Unknown brand",
        calls: 0,
        tokens: 0,
        limitHits: 0,
        firstAt: r.createdAt.toISOString(),
        answered: false,
      };
      brand.calls += 1;
      brand.tokens += tokens;
      if (limited) brand.limitHits += 1;
      if (r.outcome === "answered") brand.answered = true;
      brands.set(r.brandId, brand);
    }
  }

  const answered = [...brands.values()].filter((b) => b.answered);
  const perBrand = answered.length
    ? {
        brands: answered.length,
        tokens: Math.round(answered.reduce((s, b) => s + b.tokens, 0) / answered.length),
        calls: Math.round((answered.reduce((s, b) => s + b.calls, 0) / answered.length) * 10) / 10,
      }
    : null;

  return {
    keyDays: [...days.values()].sort((a, b) => b.day.localeCompare(a.day) || a.provider.localeCompare(b.provider, "en", { numeric: true })),
    brands: [...brands.values()].reverse().map(({ answered: _, ...b }) => b),
    perBrand,
    limitHits: hits.reverse().slice(0, recentHits),
  };
}

/**
 * Until when a key that refused a call for its limit should be left alone: what Groq says (its
 * `retry-after` header, or "Please try again in 1m26.4s" in the message), else a guess by the limit:
 * a minute for a per-minute limit, half an hour for a daily one. Never past six hours, so a key
 * whose message was misread is tried again the same day.
 */
export function restUntil(hit: { createdAt: Date; error: string | null; rateHeaders: unknown }): Date {
  const headers = (hit.rateHeaders ?? {}) as Record<string, string>;
  const header = Number.parseFloat(headers["retry-after"] ?? "");
  const said = Number.isFinite(header) && header > 0 ? header : waitInMessage(hit.error);
  const kind = limitKind(hit.error);
  const guess = kind?.endsWith("minute") ? 60 : kind ? 30 * 60 : 120;
  const seconds = Math.min(6 * 3600, Math.max(5, said ?? guess));
  return new Date(hit.createdAt.getTime() + seconds * 1000);
}

/** "try again in 1h2m3.5s" / "in 450ms" → seconds; null when the message names no wait. */
function waitInMessage(error: string | null): number | null {
  const m = error?.match(/try again in ((?:\d+(?:\.\d+)?(?:h|ms|m|s))+)/i);
  if (!m) return null;
  let seconds = 0;
  for (const [, n, unit] of m[1].matchAll(/(\d+(?:\.\d+)?)(h|ms|m|s)/gi)) {
    const v = Number(n);
    seconds += unit === "h" ? v * 3600 : unit === "m" ? v * 60 : unit === "ms" ? v / 1000 : v;
  }
  return seconds;
}

/**
 * The keys resting now, each until when: the latest refusal of each key, unless the key has answered
 * since. Read from every recorded call, so parallel jobs on separate servers share what they learn.
 */
export function restingKeys(calls: { provider: string; outcome: string; createdAt: Date; error: string | null; rateHeaders: unknown }[], now: Date): Map<string, Date> {
  const latest = new Map<string, (typeof calls)[number]>();
  for (const c of [...calls].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    if (c.outcome === "limit" || c.outcome === "answered" || c.outcome === "unusable") latest.set(c.provider, c);
  }
  const resting = new Map<string, Date>();
  for (const [provider, c] of latest) {
    if (c.outcome !== "limit") continue;
    const until = restUntil(c);
    if (until > now) resting.set(provider, until);
  }
  return resting;
}
