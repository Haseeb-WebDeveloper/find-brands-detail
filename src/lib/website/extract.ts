import * as cheerio from "cheerio";
import { domainMatchesBrand, registrableDomain } from "@/lib/website/domain";

/** What one page of a brand's site tells the later research steps. */
export type PageFacts = {
  title: string | null;
  siteName: string | null;
  description: string | null;
  instagram: string[];
  tiktok: string[];
  regionalSites: string[];
  ogImage: string | null;
  icons: string[];
  logoImages: string[];
  jsonLdLogos: string[];
};

/** Instagram paths that are not profiles. */
const IG_RESERVED = new Set(["p", "reel", "reels", "stories", "explore", "accounts", "tv", "share", "direct", "about", "developer", "legal"]);
const IG_RE = /instagram\.com\/([A-Za-z0-9._]{1,30})(?=[/?"'#\s]|$)/gi;
const TT_RE = /tiktok\.com\/@([A-Za-z0-9._]{2,24})(?=[/?"'#\s]|$)/gi;

function absolute(href: string | undefined | null, base: string): string | null {
  if (!href) return null;
  try {
    return new URL(href.trim(), base).toString();
  } catch {
    return null;
  }
}

function handles(source: string, re: RegExp, reserved = new Set<string>()): string[] {
  const out = new Set<string>();
  for (const m of source.matchAll(re)) {
    const h = m[1].toLowerCase().replace(/\.+$/, "");
    if (h && !reserved.has(h)) out.add(h);
  }
  return [...out];
}

function jsonLd($: cheerio.CheerioAPI): unknown[] {
  return $('script[type="application/ld+json"]')
    .toArray()
    .flatMap((el) => {
      try {
        const v: unknown = JSON.parse($(el).text());
        return Array.isArray(v) ? v : [v];
      } catch {
        return [];
      }
    });
}

function isString(u: string | null): u is string {
  return typeof u === "string" && u.length > 0;
}

export function extractFacts(html: string, pageUrl: string, brand: string): PageFacts {
  const $ = cheerio.load(html);
  // Handles also hide in scripts as JSON with escaped slashes (`https:\/\/www.tiktok.com\/@x`).
  const raw = html.replace(/\\\//g, "/");
  const ownOrigin = new URL(pageUrl).origin;
  const ownDomain = registrableDomain(new URL(pageUrl).hostname);

  // Other origins on the brand's own domain, or on a domain carrying the brand's name: regional
  // and sister sites (us.numbuzin.com, tirtir.co.kr). Retailers and social sites match neither.
  const regional = new Set<string>();
  const consider = (href: string | undefined) => {
    const abs = absolute(href, pageUrl);
    if (!abs) return;
    const u = new URL(abs);
    if (!/^https?:$/.test(u.protocol) || u.origin === ownOrigin) return;
    if (registrableDomain(u.hostname) === ownDomain || domainMatchesBrand(u.hostname, brand)) regional.add(u.origin);
  };
  $("a[href]").each((_, el) => consider($(el).attr("href")));
  $('link[rel="alternate"][hreflang]').each((_, el) => consider($(el).attr("href")));

  const ldLogos = jsonLd($)
    .map((o) => (o && typeof o === "object" ? (o as { logo?: unknown }).logo : null))
    .map((logo) => (typeof logo === "string" ? logo : ((logo as { url?: string } | null)?.url ?? null)))
    .map((u) => absolute(u, pageUrl))
    .filter(isString);

  const logoImages = $("img")
    .toArray()
    .filter((el) => /logo/i.test([$(el).attr("class"), $(el).attr("id"), $(el).attr("alt"), $(el).attr("src"), $(el).attr("data-src")].join(" ")))
    .map((el) => absolute($(el).attr("src") ?? $(el).attr("data-src"), pageUrl))
    .filter(isString)
    .filter((u) => !u.startsWith("data:"));

  const icons = $('link[rel~="apple-touch-icon"], link[rel~="icon"]')
    .toArray()
    .map((el) => absolute($(el).attr("href"), pageUrl))
    .filter(isString);

  return {
    title: $("title").first().text().trim() || null,
    siteName: $('meta[property="og:site_name"]').attr("content")?.trim() || null,
    description: ($('meta[name="description"]').attr("content") ?? $('meta[property="og:description"]').attr("content"))?.trim() || null,
    instagram: handles(raw, IG_RE, IG_RESERVED),
    tiktok: handles(raw, TT_RE),
    regionalSites: [...regional],
    ogImage: absolute($('meta[property="og:image"]').attr("content"), pageUrl),
    icons: [...new Set(icons)],
    logoImages: [...new Set(logoImages)],
    jsonLdLogos: [...new Set(ldLogos)],
  };
}
