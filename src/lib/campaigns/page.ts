import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { absolute, realSource } from "@/lib/website/img-source";

const SKIP = /\.(svg|gif)(\?|$)|^data:|logo|icon|avatar|sprite|placeholder|spacer|pixel|badge/i;
const MAX_IMAGES = 6;
/** Images declared smaller than this on both sides are thumbnails, buttons or ads. */
const MIN_DECLARED = 300;
/** Enough to tell whether the page is about the campaign; the description prompt takes less. */
const MAX_TEXT = 6_000;

/** An image address's path, readable ("red%20cushion.jpg" → "red cushion.jpg"). */
function filePath(src: string): string {
  const path = new URL(src).pathname;
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/** The images JSON-LD declares for the page (an article's lead image, a product's photos). */
function jsonLdImages($: CheerioAPI): string[] {
  const out: string[] = [];
  const take = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(take);
    else if (v && typeof v === "object" && typeof (v as { url?: unknown }).url === "string") out.push((v as { url: string }).url);
  };
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    if (o.image) take(o.image);
    if (o["@graph"]) walk(o["@graph"]);
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      walk(JSON.parse($(el).text()));
    } catch {
      // A broken block is skipped; the page's other images still count.
    }
  });
  return out;
}

/**
 * What a campaign's source page offers: its images and text to describe it from. Images, best first:
 * those whose description, caption or file name names the campaign (`words`, its distinctive words),
 * then the page's declared share and lead images (og:image, twitter:image, JSON-LD), then the other
 * article images. Lazy-loaded images and <picture> sources count; declared thumbnails don't.
 */
export function readCampaignPage(html: string, url: string, words: string[] = []): { images: string[]; text: string } {
  const $ = cheerio.load(html);
  const shared: (string | null)[] = [
    absolute($('meta[property="og:image"]').attr("content"), url),
    absolute($('meta[name="twitter:image"]').attr("content") ?? $('meta[property="twitter:image"]').attr("content"), url),
    ...jsonLdImages($).map((u) => absolute(u, url)),
  ];

  const named: string[] = [];
  const other: string[] = [];
  const scope = $("article, main").length > 0 ? "article, main" : "body";
  $(scope)
    .find("img, picture source")
    .each((_, el) => {
      const node = $(el);
      const src = absolute(realSource((n) => node.attr(n)), url);
      if (!src) return;
      const w = Number(node.attr("width")), h = Number(node.attr("height"));
      if (w > 0 && h > 0 && Math.max(w, h) < MIN_DECLARED) return;
      const img = node.is("source") ? node.closest("picture").find("img").first() : node;
      const label = [img.attr("alt"), img.attr("title"), img.closest("figure").find("figcaption").text(), filePath(src)]
        .join(" ")
        .toLowerCase();
      (words.some((word) => label.includes(word)) ? named : other).push(src);
    });

  const images = [...new Set([...named, ...shared, ...other].filter((u): u is string => u !== null && !SKIP.test(u)))].slice(0, MAX_IMAGES);

  const paragraphs = $("article p, main p").length > 0 ? $("article p, main p") : $("p");
  const text = [$("title").first().text(), $('meta[name="description"]').attr("content") ?? "", ...paragraphs.toArray().map((p) => $(p).text())]
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_TEXT);
  return { images, text };
}
