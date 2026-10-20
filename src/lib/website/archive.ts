import "server-only";
import { fetchPage } from "@/lib/website/fetch-page";
import type { FetchedPage } from "@/lib/website/judge";

export function parseCdx(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json
    .slice(1)
    .map((row) => (Array.isArray(row) ? String(row[0] ?? "") : ""))
    .filter((ts) => /^\d{14}$/.test(ts))
    .sort()
    .reverse();
}

export function snapshotUrl(timestamp: string, url: string): string {
  return `https://web.archive.org/web/${timestamp}id_/${url}`;
}

/**
 * The newest usable capture from the last three years, or null. "Usable" means a real page: the
 * newest captures of a hijacked or parked domain are the hijack or the parking page, so a capture
 * that is tiny or is a /lander bounce is skipped in favour of an older one.
 */
export async function latestSnapshot(url: string, now = new Date()): Promise<{ timestamp: string; page: FetchedPage } | null> {
  const host = new URL(url).hostname;
  const from = String(now.getUTCFullYear() - 3);
  const cdx = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(host)}&output=json&filter=statuscode:200&collapse=timestamp:6&from=${from}&fl=timestamp`;
  try {
    const res = await fetch(cdx, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    for (const ts of parseCdx(await res.json()).slice(0, 6)) {
      const page = await fetchPage(snapshotUrl(ts, `https://${host}/`));
      if (page.ok && page.html.length >= 2_000 && !/\/lander/.test(page.html.slice(0, 500))) return { timestamp: ts, page };
    }
    return null;
  } catch {
    return null;
  }
}
