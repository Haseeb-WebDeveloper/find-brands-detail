const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const PAUSE_MS = 2_000;

/**
 * Instagram's crawler-facing page embeds the profile JSON. The flag must belong to `username`, not
 * to a suggested account elsewhere on the page, so the nearest flag within 400 characters of the
 * username's own JSON entry is read.
 */
export function parseBadge(html: string, username: string): boolean | null {
  const at = html.indexOf(`"username":"${username}"`);
  if (at < 0) return null;
  const window = html.slice(Math.max(0, at - 400), at + 400);
  const m = window.match(/"is_verified":(true|false)/);
  return m ? m[1] === "true" : null;
}

let last = 0;

/** Paced, never throws; any failure is "unknown" (null), never "not verified". */
export async function fetchBadge(username: string): Promise<boolean | null> {
  const wait = last + PAUSE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  try {
    const res = await fetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
      headers: { "user-agent": GOOGLEBOT },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return parseBadge(await res.text(), username);
  } catch {
    return null;
  }
}
