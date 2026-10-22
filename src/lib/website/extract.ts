import * as cheerio from "cheerio";
import { domainMatchesBrand, registrableDomain } from "@/lib/website/domain";
import { absolute, backgroundImage, realSource } from "@/lib/website/img-source";

/** What one page of a brand's site tells the later research steps. */
export type PageFacts = {
  title: string | null;
  siteName: string | null;
  description: string | null;
  instagram: string[];
  tiktok: string[];
  regionalSites: string[];
  /** Primary language subtag of <html lang> ("ja" from "ja-JP"), lowercase; null when absent. */
  lang: string | null;
  ogImage: string | null;
  /** The page's banner images (hero, slider, carousel), first slide first: cover candidates. */
  bannerImages?: string[];
  icons: string[];
  logoImages: string[];
  jsonLdLogos: string[];
};

/** Instagram paths that are not profiles. */
const IG_RESERVED = new Set(["p", "reel", "reels", "stories", "explore", "accounts", "tv", "share", "direct", "about", "developer", "legal"]);
const IG_RE = /instagram\.com\/([A-Za-z0-9._]{1,30})(?=[/?"'#\s]|$)/gi;
const TT_RE = /tiktok\.com\/@([A-Za-z0-9._]{2,24})(?=[/?"'#\s]|$)/gi;


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

/** Where sites put their banners: a hero, banner, slider, carousel, key visual… in a class or id. */
const BANNER_AREA = /hero|banner|slide|carousel|swiper|keyvisual|key-visual|main-?visual|billboard|masthead|jumbotron/i;
/** Never a banner: icons, logos, placeholders, and product shots from a product slider. */
const NOT_BANNER = /\.(svg|gif)(\?|$)|^data:|logo|icon|avatar|sprite|placeholder|spacer|pixel|badge|thumb|btn[_-]|button|\/products?\//i;
/** Areas whose images are never the page's banner: menus, navigation, drawers, footers. */
const NOT_AREA = /menu|(^|[\s_-])nav|drawer|footer/i;
const MAX_BANNERS = 6;

/**
 * The banner images of a page, first slide first: <img>s, <picture> sources and inline background
 * images inside a banner area, at their real (lazy-loaded, largest) address. Images declared small
 * or not landscape are left out; undeclared ones are measured later, at the image check.
 */
function bannerImages($: cheerio.CheerioAPI, pageUrl: string): string[] {
  const out: string[] = [];
  $("img, picture source, [style*=background]").each((_, el) => {
    if (out.length >= MAX_BANNERS * 2) return;
    const node = $(el);
    const areas = node
      .parents()
      .addBack()
      .toArray()
      .map((e) => `${$(e).attr("class") ?? ""} ${$(e).attr("id") ?? ""}`);
    // A menu's promo tiles (TIRTIR's mega menu: 3000×1500 "bestsellers") are not the page's banner.
    if (!areas.some((a) => BANNER_AREA.test(a)) || areas.some((a) => NOT_AREA.test(a)) || node.closest("nav, footer").length > 0) return;
    const raw = node.is("img, source") ? realSource((n) => node.attr(n)) : backgroundImage(node.attr("style"));
    const src = absolute(raw, pageUrl);
    if (!src || NOT_BANNER.test(src)) return;
    const w = Number(node.attr("width")), h = Number(node.attr("height"));
    if (w > 0 && h > 0 && (Math.max(w, h) < 600 || w / h < 1.2)) return;
    out.push(src);
  });
  return [...new Set(out)].slice(0, MAX_BANNERS);
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
    lang: $("html").attr("lang")?.trim().toLowerCase().split(/[-_]/)[0] || null,
    ogImage: absolute($('meta[property="og:image"]').attr("content"), pageUrl),
    bannerImages: bannerImages($, pageUrl),
    icons: [...new Set(icons)],
    logoImages: [...new Set(logoImages)],
    jsonLdLogos: [...new Set(ldLogos)],
  };
}
