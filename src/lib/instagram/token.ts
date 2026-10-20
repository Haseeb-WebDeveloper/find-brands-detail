const DAY_MS = 24 * 60 * 60 * 1000;

/** Spec §9: the app warns before the 60-day Meta token runs out. Reads env only; never the token's value. */
export function metaTokenStatus(now = new Date()): { configured: boolean; expiresAt: string | null; daysLeft: number | null; warn: boolean } {
  const configured = Boolean(process.env.META_ACCESS_TOKEN && process.env.META_IG_USER_ID);
  const expiresAt = process.env.META_TOKEN_EXPIRES_AT ?? null;
  if (!configured) return { configured: false, expiresAt: null, daysLeft: null, warn: true };
  const daysLeft = expiresAt ? Math.floor((new Date(expiresAt).getTime() - now.getTime()) / DAY_MS) : null;
  return { configured, expiresAt, daysLeft, warn: daysLeft !== null && daysLeft <= 7 };
}
