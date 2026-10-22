/**
 * Free image search for campaign visuals, with no AI and no key (owner, 2026-10-22: "free, always").
 * DuckDuckGo's image results first (they carry each image's size), Bing's when DuckDuckGo fails.
 * Both are the sites' own pages, not official APIs: either can change or refuse without notice, so
 * every failure is "no results", never an error.
 */

import { compactName } from "@/lib/website/domain";

export type ImageHit = { url: string; page: string; title: string; width: number | null; height: number | null };

const UA = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  "accept-language": "en-US,en;q=0.9",
};
const TIMEOUT_MS = 15_000;

/** DuckDuckGo's image JSON (i.js). */
export function parseDuckDuckGo(json: unknown): ImageHit[] {
  const results = ((json ?? {}) as { results?: { image?: string; url?: string; title?: string; width?: number; height?: number }[] }).results ?? [];
  return results.flatMap((r) => (r.image && r.url ? [{ url: r.image, page: r.url, title: r.title ?? "", width: r.width ?? null, height: r.height ?? null }] : []));
}

/** Bing's image results page: each result carries a JSON attribute with the image (murl) and its page (purl). */
export function parseBing(html: string): ImageHit[] {
  const out: ImageHit[] = [];
  for (const m of html.matchAll(/\bm="(\{[^"]+\})"/g)) {
    try {
      const x = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&")) as { murl?: string; purl?: string; t?: string };
      if (x.murl && x.purl) out.push({ url: x.murl, page: x.purl, title: x.t ?? "", width: null, height: null });
    } catch {
      // One unreadable result is skipped.
    }
  }
  return out;
}

/** `wide`: large landscape images only, for covers (DuckDuckGo: 97 of 100 results landscape, measured 2026-10-22). */
type SearchOptions = { wide?: boolean };

async function duckDuckGo(query: string, { wide }: SearchOptions): Promise<ImageHit[]> {
  const q = encodeURIComponent(query);
  const page = await (await fetch(`https://duckduckgo.com/?q=${q}&iax=images&ia=images`, { headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS) })).text();
  const vqd = page.match(/vqd=["']?([\d-]+)/)?.[1];
  if (!vqd) return [];
  const filters = encodeURIComponent(wide ? ",size:Large,,,layout:Wide," : ",,,,,");
  const res = await fetch(`https://duckduckgo.com/i.js?l=us-en&o=json&q=${q}&vqd=${vqd}&f=${filters}&p=1`, {
    headers: { ...UA, referer: "https://duckduckgo.com/" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return res.ok ? parseDuckDuckGo(await res.json()) : [];
}

async function bing(query: string, { wide }: SearchOptions): Promise<ImageHit[]> {
  const filters = wide ? `&qft=${encodeURIComponent("+filterui:aspect-wide+filterui:imagesize-large")}` : "";
  const res = await fetch(`https://www.bing.com/images/async?q=${encodeURIComponent(query)}&first=0&count=35&mmasync=1${filters}`, { headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS) });
  return res.ok ? parseBing(await res.text()) : [];
}

/** Image results for a query: DuckDuckGo's, else Bing's, else none. Never throws. */
export async function searchImages(query: string, options: SearchOptions = {}): Promise<{ hits: ImageHit[]; engine: "DuckDuckGo" | "Bing" | null }> {
  for (const [engine, run] of [["DuckDuckGo", duckDuckGo], ["Bing", bing]] as const) {
    try {
      const hits = await run(query, options);
      if (hits.length > 0) return { hits, engine };
    } catch {
      // Blocked or changed: try the next engine.
    }
  }
  return { hits: [], engine: null };
}

/** The campaign frame (db-admin's fill aspect), to prefer results that need the least cropping. */
const CAMPAIGN_SHAPE = 200 / 236;
const MIN_EDGE = 800;
/** Hosts whose images are thumbnails or redirects, never the picture itself. */
const JUNK = /(^|\.)(gstatic\.com|fbsbx\.com|bing\.net)$/;

/**
 * The results worth checking, best first, by rules alone: the page title or file name must carry at
 * least half of the campaign's distinctive words; then the brand's own site; then the image's size
 * and how close it is to the campaign frame. A result declared under 800 px is left out.
 */
export function rankHits(hits: ImageHit[], words: string[], owned: (url: string) => boolean, max: number): ImageHit[] {
  if (words.length === 0) return [];
  const host = (u: string) => {
    try {
      return new URL(u).hostname;
    } catch {
      return "";
    }
  };
  const seen = new Set<string>();
  return hits
    .filter((h) => !JUNK.test(host(h.url)) && !(seen.has(h.url) || !seen.add(h.url)))
    .filter((h) => !(h.width && h.height && Math.max(h.width, h.height) < MIN_EDGE))
    .map((h) => {
      let file = "";
      try {
        file = decodeURIComponent(new URL(h.url).pathname);
      } catch {
        file = h.url;
      }
      const text = `${h.title} ${file}`.toLowerCase();
      const hits = words.filter((w) => text.includes(w)).length;
      const misfit = h.width && h.height ? Math.abs(Math.log(h.width / h.height / CAMPAIGN_SHAPE)) : 1;
      return { h, hits, own: owned(h.page) || owned(h.url), misfit, size: Math.min(h.width ?? 0, h.height ?? 0) };
    })
    .filter((x) => x.hits >= Math.ceil(words.length / 2))
    .sort((a, b) => b.hits - a.hits || Number(b.own) - Number(a.own) || Math.round(a.misfit * 10) - Math.round(b.misfit * 10) || b.size - a.size)
    .slice(0, max)
    .map((x) => x.h);
}

/** The cover frame (db-admin's fill aspect) and the narrowest a cover may be (images/score.ts). */
const COVER_SHAPE = 16 / 11;
const MIN_COVER_RATIO = 1.3;

/**
 * Cover results worth checking, best first, by rules alone: the page title or file name names the
 * brand; declared landscape and at least 800 px; then the brand's own site; then the closest to the
 * cover frame, and the biggest.
 */
export function rankCoverHits(hits: ImageHit[], brand: string, owned: (url: string) => boolean, max: number): ImageHit[] {
  const name = compactName(brand);
  if (!name) return [];
  const seen = new Set<string>();
  return hits
    .filter((h) => !JUNK.test(hostOf(h.url)) && !(seen.has(h.url) || !seen.add(h.url)))
    .filter((h) => compactName(`${h.title} ${fileOf(h.url)}`).includes(name))
    .filter((h) => !(h.width && h.height && (Math.max(h.width, h.height) < MIN_EDGE || h.width / h.height < MIN_COVER_RATIO)))
    .map((h) => ({
      h,
      own: owned(h.page) || owned(h.url),
      misfit: h.width && h.height ? Math.abs(Math.log(h.width / h.height / COVER_SHAPE)) : 1,
      size: Math.min(h.width ?? 0, h.height ?? 0),
    }))
    .sort((a, b) => Number(b.own) - Number(a.own) || Math.round(a.misfit * 10) - Math.round(b.misfit * 10) || b.size - a.size)
    .slice(0, max)
    .map((x) => x.h);
}

function hostOf(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
}

function fileOf(u: string): string {
  try {
    return decodeURIComponent(new URL(u).pathname);
  } catch {
    return u;
  }
}
