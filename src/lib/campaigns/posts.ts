import { compactName } from "@/lib/website/domain";
import type { IgPost } from "@/lib/instagram/history";

/** Words every beauty caption uses, so they don't identify a campaign. */
const STOP = new Set([
  "with", "from", "your", "this", "that", "launch", "campaign", "collection", "edition", "glow",
  "skin", "beauty", "care", "skincare", "makeup", "official", "global", "new", "the", "and", "for",
  "spring", "summer", "autumn", "fall", "winter", "holiday", "season", "seasonal", "renewal", "radiance", "radiant",
  "hydration", "routine", "series", "creator", "creators", "collaboration", "relaunch", "kit", "gift", "gifts", "set",
  "hero", "store", "popup", "event", "special", "limited",
]);
/** Images taken from matching posts, slides included. */
const MAX_POST_IMAGES = 4;

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

/** Months from a campaign's date ("2024-03", or "2024" as its January) to a post's timestamp. */
function monthsAfter(date: string, timestamp: string): number | null {
  const m = /^(\d{4})(?:-(\d{2}))?$/.exec(date);
  const t = new Date(timestamp);
  if (!m || Number.isNaN(t.getTime())) return null;
  return (t.getUTCFullYear() - Number(m[1])) * 12 + (t.getUTCMonth() + 1 - Number(m[2] ?? 1));
}

/**
 * The brand's posts about the campaign, as brand-owned images for it: posts whose caption (hashtags
 * included) has at least half of the title's distinctive words, every slide of a carousel. With a
 * campaign date, posts from its launch (a month before to six after) come first, then the nearest;
 * posts two years away are a later re-post or a coincidence and are left out.
 */
export function matchPosts(campaign: { title: string; date: string | null }, brand: string, posts: IgPost[]): string[] {
  const words = distinctiveWords(campaign.title, brand);
  if (words.length === 0) return [];
  const matched = posts
    .filter((p) => p.images.length > 0 && p.caption)
    // At least half of the title's distinctive words: one shared word is often a coincidence.
    .filter((p) => words.filter((w) => (p.caption ?? "").toLowerCase().includes(w)).length >= Math.ceil(words.length / 2))
    .map((p, i) => {
      const away = campaign.date ? monthsAfter(campaign.date, p.timestamp) : null;
      const distance = away === null ? 0 : away >= -1 && away <= 6 ? 0 : Math.abs(away);
      return { p, i, distance };
    })
    .filter((x) => x.distance <= 24)
    .sort((a, b) => a.distance - b.distance || a.i - b.i);
  return [...new Set(matched.flatMap((x) => x.p.images))].slice(0, MAX_POST_IMAGES);
}
