/**
 * Fixed-window limiter, per server instance. Enough to stop a login form being hammered; not a
 * substitute for Supabase's own email rate limits, which still apply.
 */
const windows = new Map<string, { start: number; count: number }>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
  now = Date.now(),
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    return { ok: true };
  }
  if (w.count < limit) {
    w.count++;
    return { ok: true };
  }
  return { ok: false, retryAfterSeconds: Math.ceil((w.start + windowMs - now) / 1000) };
}
