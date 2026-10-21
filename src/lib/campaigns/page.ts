import * as cheerio from "cheerio";

const SKIP = /\.(svg|gif)(\?|$)|^data:|logo|icon|avatar|sprite|placeholder|spacer|pixel|badge/i;
const MAX_IMAGES = 4;
const MAX_TEXT = 1_500;

function absolute(href: string | undefined, base: string): string | null {
  if (!href) return null;
  try {
    return new URL(href.trim(), base).toString();
  } catch {
    return null;
  }
}

/** The largest candidate of a srcset ("a.jpg 400w, b.jpg 1600w" → b.jpg). */
function largest(srcset: string): string | undefined {
  return srcset
    .split(",")
    .map((part) => part.trim().split(/\s+/))
    .map(([u, w]) => ({ u, w: Number.parseFloat(w ?? "0") || 0 }))
    .sort((a, b) => b.w - a.w)[0]?.u;
}

/** What a campaign's source page offers: its share images and article images, and text to describe it from. */
export function readCampaignPage(html: string, url: string): { images: string[]; text: string } {
  const $ = cheerio.load(html);
  const found: (string | null)[] = [
    absolute($('meta[property="og:image"]').attr("content"), url),
    absolute($('meta[name="twitter:image"]').attr("content") ?? $('meta[property="twitter:image"]').attr("content"), url),
  ];
  const body = $("article, main").length > 0 ? $("article img, main img") : $("body img");
  body.each((_, el) => {
    const img = $(el);
    const srcset = img.attr("srcset");
    found.push(absolute((srcset ? largest(srcset) : undefined) ?? img.attr("src") ?? img.attr("data-src"), url));
  });
  const images = [...new Set(found.filter((u): u is string => u !== null && !SKIP.test(u)))].slice(0, MAX_IMAGES);

  const paragraphs = $("article p, main p").length > 0 ? $("article p, main p") : $("p");
  const text = [$("title").first().text(), $('meta[name="description"]').attr("content") ?? "", ...paragraphs.toArray().map((p) => $(p).text())]
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_TEXT);
  return { images, text };
}
