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

/** The words of a campaign title that identify it: not the brand's name, not words every caption uses. */
export function distinctiveWords(title: string, brand: string): string[] {
  const own = compactName(brand);
  return title
    .toLowerCase()
    .split(/[^a-z0-9à-ɏ]+/)
    .filter((w) => w.length >= 4 && !STOP.has(w) && compactName(w) !== own);
}

/**
 * Whether a source page is about the campaign: it names the brand and at least one distinctive word
 * of the title. Invented URLs often return 200 with a generic page (a newsroom index, an empty shell).
 */
export function pageMentions(text: string, title: string, brand: string): boolean {
  const lower = text.toLowerCase();
  if (!compactName(lower).includes(compactName(brand))) return false;
  const words = distinctiveWords(title, brand);
  return words.length === 0 || words.some((w) => lower.includes(w));
}

/** Recent brand posts whose caption names the campaign: brand-owned imagery for it. */
export function matchPosts(title: string, brand: string, posts: { mediaUrl: string | null; caption: string | null; mediaType: string }[]): string[] {
  const words = distinctiveWords(title, brand);
  if (words.length === 0) return [];
  return posts
    .filter((p) => p.mediaType !== "VIDEO" && p.mediaUrl && p.caption)
    // At least half of the title's distinctive words: one shared word is often a coincidence.
    .filter((p) => words.filter((w) => (p.caption ?? "").toLowerCase().includes(w)).length >= Math.ceil(words.length / 2))
    .map((p) => p.mediaUrl as string)
    .slice(0, MAX_POSTS);
}
