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

const HANGUL = /^[가-힯]+$/;

/**
 * The words of a campaign title that identify it: not the brand's name, not words every caption
 * uses. Latin words of 4+ letters, acronyms in capitals ("NCT", "BTS") and Korean words of 2+
 * syllables ("화잘먹").
 */
export function distinctiveWords(title: string, brand: string): string[] {
  const own = compactName(brand);
  return title
    .split(/[^A-Za-z0-9À-ɏ가-힯]+/)
    .filter((w) => (HANGUL.test(w) ? w.length >= 2 : w.length >= 4 || /^[A-Z0-9]{2,3}$/.test(w)))
    .map((w) => w.toLowerCase())
    .filter((w) => !STOP.has(w) && compactName(w) !== own);
}

/**
 * Whether a source page is about the campaign. Invented URLs often return 200 with a generic page (a
 * newsroom index, an empty shell), so loading proves nothing. The page must name the brand and one
 * distinctive word of the title, or — a Korean article writes "넘버즈인", not "numbuzin" — two of them.
 */
export function pageMentions(text: string, title: string, brand: string): boolean {
  const lower = text.toLowerCase();
  const words = distinctiveWords(title, brand);
  const hits = words.filter((w) => lower.includes(w)).length;
  const namesBrand = compactName(lower).includes(compactName(brand));
  if (words.length === 0) return namesBrand;
  return (namesBrand && hits >= 1) || hits >= 2;
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
