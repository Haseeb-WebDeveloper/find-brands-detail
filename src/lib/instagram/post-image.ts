/**
 * An Instagram post link pasted where an image address goes: the reviewer finds a campaign's post on
 * Google and pastes its link, instead of opening the inspector to copy the image's address.
 *
 * Instagram's page for crawlers (the Googlebot user agent, as `badge.ts` reads profiles) carries the
 * post's own data: every slide of a carousel, each in several sizes. Its `og:image` is only a
 * 640×640 preview, so the full-size original is read from that data, and `og:image` is the last
 * resort. A carousel link with `?img_index=3` (what Instagram puts in the address bar on slide 3)
 * picks that slide; without one, the first.
 *
 * The image links expire after a few days like every Instagram image (`images/expiry.ts` reads the
 * date and the review says so).
 */

export type PostImage = { url: string; width: number | null; height: number | null };

export type PostLink = { code: string; slide: number };

/** "instagram.com/p/CODE", "/reel/CODE", "/username/p/CODE"; `img_index` is the slide (1-based). */
export function instagramPostLink(input: string): PostLink | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return null;
  const m = url.pathname.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  if (!m) return null;
  const slide = Number.parseInt(url.searchParams.get("img_index") ?? "1", 10);
  return { code: m[1], slide: Number.isFinite(slide) && slide > 0 ? slide : 1 };
}

/** The JSON value (object or array) that starts at `start`, read past strings and their escapes. */
function jsonAt(text: string, start: number): unknown {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

type Candidate = { url?: string; width?: number; height?: number };
type Media = { image_versions2?: { candidates?: Candidate[] } };

/** The largest size of one image. */
function largest(media: Media | null | undefined): PostImage | null {
  const candidates = (media?.image_versions2?.candidates ?? []).filter((c): c is Candidate & { url: string } => typeof c.url === "string");
  if (candidates.length === 0) return null;
  const best = candidates.reduce((a, b) => ((b.width ?? 0) > (a.width ?? 0) ? b : a));
  return { url: best.url, width: best.width ?? null, height: best.height ?? null };
}

const decode = (s: string) => s.replaceAll("&amp;", "&");
/** An image's file name ("858008034_1812…_n.jpg"), which every size of it shares. */
const fileOf = (url: string) => url.match(/\/([^/?]+_n\.[a-z]+)\?/i)?.[1] ?? null;

/** How far before its slides a carousel's own `"code"` sits in the page's data. */
const CODE_REACH = 6_000;

/**
 * The post's slides, full size, in order. The page also carries other posts (the profile's grid), so
 * a carousel is the post's only when the nearest `"code"` before it is the post's; a single image
 * only when it is the same file as the post's `og:image`. (A carousel's `og:image` can be another
 * frame, a video's cover, so it can't identify a carousel; checked against Meta's `media_url`.)
 */
export function parsePostImages(html: string, code: string): PostImage[] {
  for (const m of html.matchAll(/"carousel_media":\[/g)) {
    const before = [...html.slice(Math.max(0, m.index - CODE_REACH), m.index).matchAll(/"code":"([A-Za-z0-9_-]+)"/g)].at(-1)?.[1];
    if (before !== code) continue;
    const slides = jsonAt(html, m.index + m[0].length - 1);
    if (!Array.isArray(slides)) continue;
    const images = slides.map((s) => largest(s as Media)).filter((i): i is PostImage => i !== null);
    if (images.length > 0) return images;
  }
  const og = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  const own = og ? fileOf(decode(og)) : null;
  if (!og || !own) return [];
  for (const m of html.matchAll(/"image_versions2":\{/g)) {
    const image = largest({ image_versions2: jsonAt(html, m.index + m[0].length - 1) as Media["image_versions2"] });
    if (image && fileOf(image.url) === own) return [image];
  }
  return [{ url: decode(og), width: null, height: null }];
}

/** Who posted it, from the post's own data: the username nearest after its code. */
export function parsePostOwner(html: string, code: string): string | null {
  const at = html.indexOf(`"code":"${code}"`);
  if (at < 0) return null;
  return html.slice(at, at + 3000).match(/"username":"([A-Za-z0-9._]+)"/)?.[1]?.toLowerCase() ?? null;
}

const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

export type PostImageResult =
  | { ok: true; image: PostImage; slide: number; slides: number; owner: string | null }
  | { ok: false; error: string };

/** Never throws; a failure is a sentence for the reviewer. */
export async function resolvePostImage(link: PostLink): Promise<PostImageResult> {
  let html: string;
  try {
    const res = await fetch(`https://www.instagram.com/p/${link.code}/`, { headers: { "user-agent": GOOGLEBOT }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { ok: false, error: `Instagram didn't show that post (${res.status}). Paste the image's address instead.` };
    html = await res.text();
  } catch {
    return { ok: false, error: "Instagram didn't answer. Try again, or paste the image's address instead." };
  }
  const images = parsePostImages(html, link.code);
  if (images.length === 0) return { ok: false, error: "That post has no image Instagram shows without signing in. Paste the image's address instead." };
  if (link.slide > images.length) return { ok: false, error: `That post has ${images.length} image${images.length === 1 ? "" : "s"}, not ${link.slide}.` };
  return { ok: true, image: images[link.slide - 1], slide: link.slide, slides: images.length, owner: parsePostOwner(html, link.code) };
}
