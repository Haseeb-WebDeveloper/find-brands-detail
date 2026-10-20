/** Only a path on this site, and never back to /login or /auth; anything else falls back. */
export function safeNext(value: unknown, fallback = "/batches"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/auth/")) return fallback;
  return value;
}
