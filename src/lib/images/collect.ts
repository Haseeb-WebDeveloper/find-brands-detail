import type { PageFacts } from "@/lib/website/extract";
import type { ImageSource } from "@/lib/images/score";

export type ImagesInput = {
  brand: string;
  /** The brand's own domains, to rank its site's images first in an image search. */
  brandDomains: string[];
  pages: { url: string; facts: PageFacts }[];
  instagram: { handle: string; picture: string | null; posts: string[] } | null;
  tiktok: { handle: string; avatar: string | null } | null;
};
export type ImageLead = { slot: "logo" | "cover"; url: string; source: ImageSource };

const MAX_LOGOS = 8;
const MAX_COVERS = 8;
/** Banners per page taken before its share image: the first slides are the current campaign. */
const LEAD_BANNERS = 2;
const MAX_POSTS = 3;
const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");

/**
 * Where a brand's logo and cover can come from, best guesses first: the site's declared logo
 * (JSON-LD, then logo <img>s), the Instagram and TikTok profile pictures, then site icons (usually
 * too small). Covers: each page's first banners (hero, slider) and its og:image, then its other
 * banners, then recent Instagram posts.
 */
export function collectImages(input: ImagesInput): ImageLead[] {
  const out: ImageLead[] = [];
  const seen = new Set<string>();
  const add = (slot: ImageLead["slot"], url: string | null, source: ImageSource, max: number) => {
    if (!url || seen.has(`${slot} ${url}`) || out.filter((o) => o.slot === slot).length >= max) return;
    seen.add(`${slot} ${url}`);
    out.push({ slot, url, source });
  };
  const site = (page: { url: string }): ImageSource => ({ kind: "site", label: host(page.url) });

  for (const p of input.pages) for (const u of p.facts.jsonLdLogos) add("logo", u, site(p), MAX_LOGOS);
  for (const p of input.pages) for (const u of p.facts.logoImages) add("logo", u, site(p), MAX_LOGOS);
  if (input.instagram) add("logo", input.instagram.picture, { kind: "instagram", label: `@${input.instagram.handle}'s Instagram profile picture` }, MAX_LOGOS);
  if (input.tiktok) add("logo", input.tiktok.avatar, { kind: "tiktok", label: `@${input.tiktok.handle}'s TikTok profile picture` }, MAX_LOGOS);
  for (const p of input.pages) for (const u of p.facts.icons) add("logo", u, site(p), MAX_LOGOS);

  for (const p of input.pages) {
    for (const u of (p.facts.bannerImages ?? []).slice(0, LEAD_BANNERS)) add("cover", u, site(p), MAX_COVERS);
    add("cover", p.facts.ogImage, site(p), MAX_COVERS);
  }
  for (const p of input.pages) for (const u of (p.facts.bannerImages ?? []).slice(LEAD_BANNERS)) add("cover", u, site(p), MAX_COVERS);
  const ig = input.instagram;
  if (ig) for (const u of ig.posts.slice(0, MAX_POSTS)) add("cover", u, { kind: "instagram", label: `a recent @${ig.handle} post` }, MAX_COVERS);
  return out;
}
