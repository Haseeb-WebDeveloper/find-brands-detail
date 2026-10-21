import { compactName } from "@/lib/website/domain";

/** Words every beauty caption uses, so they don't identify a campaign. */
const STOP = new Set([
  "with", "from", "your", "this", "that", "launch", "campaign", "collection", "edition", "glow",
  "skin", "beauty", "care", "skincare", "makeup", "official", "global", "new", "the", "and", "for",
  "spring", "summer", "autumn", "fall", "winter", "holiday", "season", "seasonal", "renewal", "radiance", "radiant",
  "hydration", "routine", "series", "creator", "creators", "collaboration", "relaunch", "kit", "gift", "gifts", "set",
  "hero", "store", "popup", "event", "special", "limited",
]);
const MAX_POSTS = 2;

/** Recent brand posts whose caption names the campaign: brand-owned imagery for it. */
export function matchPosts(title: string, brand: string, posts: { mediaUrl: string | null; caption: string | null; mediaType: string }[]): string[] {
  const own = compactName(brand);
  const words = title
    .toLowerCase()
    .split(/[^a-z0-9à-ɏ]+/)
    .filter((w) => w.length >= 4 && !STOP.has(w) && compactName(w) !== own);
  if (words.length === 0) return [];
  return posts
    .filter((p) => p.mediaType !== "VIDEO" && p.mediaUrl && p.caption)
    // At least half of the title's distinctive words: one shared word is often a coincidence.
    .filter((p) => words.filter((w) => (p.caption ?? "").toLowerCase().includes(w)).length >= Math.ceil(words.length / 2))
    .map((p) => p.mediaUrl as string)
    .slice(0, MAX_POSTS);
}
