/** A brand's post, with every image it shows: one for a photo, each slide for a carousel, none for a video. */
export type IgPost = { mediaType: string; images: string[]; caption: string | null; timestamp: string; permalink: string };

type RawMedia = {
  media_type?: string;
  media_url?: string;
  permalink?: string;
  caption?: string;
  timestamp?: string;
  children?: { data?: { media_type?: string; media_url?: string }[] };
};
type RawPage = {
  business_discovery?: { media?: { data?: RawMedia[]; paging?: { cursors?: { after?: string } } } };
  error?: { message?: string };
};

export function parseMediaPage(json: unknown): { posts: IgPost[]; after: string | null; error: string | null } {
  const raw = (json ?? {}) as RawPage;
  if (raw.error) return { posts: [], after: null, error: raw.error.message ?? "Meta returned an error." };
  const media = raw.business_discovery?.media;
  const posts = (media?.data ?? []).map((m) => {
    const slides = (m.children?.data ?? []).filter((c) => c.media_type === "IMAGE" && c.media_url).map((c) => c.media_url as string);
    const images = m.media_type === "CAROUSEL_ALBUM" ? slides : m.media_type === "IMAGE" && m.media_url ? [m.media_url] : [];
    return { mediaType: m.media_type ?? "UNKNOWN", images, caption: m.caption ?? null, timestamp: m.timestamp ?? "", permalink: m.permalink ?? "" };
  });
  return { posts, after: media?.paging?.cursors?.after ?? null, error: null };
}

const PAGE_SIZE = 50;
/** 8 × 50 posts: about 18 months for a busy brand (TIRTIR, 2026-10-22). */
const MAX_PAGES = 8;
/** With no date to aim for, the last 100 posts. */
const UNDATED_PAGES = 2;
/**
 * Paging stops once Meta's hourly use passes this share: the other half is kept for finding brands'
 * accounts, which a batch needs more. A page of 50 posts with their slides costs about 2.5% of the
 * hourly time allowance (measured 2026-10-22: ten calls, 24%).
 */
const USAGE_CEILING = 50;

/** The highest of Meta's hourly usage figures (calls, CPU time, total time), in percent; 0 when not sent. */
export function metaUsage(header: string | null): number {
  if (!header) return 0;
  try {
    const u = JSON.parse(header) as Record<string, unknown>;
    return Math.max(0, ...["call_count", "total_cputime", "total_time"].map((k) => (typeof u[k] === "number" ? (u[k] as number) : 0)));
  } catch {
    return 0;
  }
}

/**
 * The brand's posts, newest first, back to `since` (the oldest campaign's month), or the last 100
 * when no campaign has a date; fewer when Meta's hourly use runs high. Never throws: a failure keeps
 * what was read, with the reason.
 */
export async function fetchPostHistory(username: string, since: Date | null): Promise<{ posts: IgPost[]; error: string | null }> {
  const token = process.env.META_ACCESS_TOKEN;
  const igUser = process.env.META_IG_USER_ID;
  if (!token || !igUser) return { posts: [], error: "The Meta token is missing or expired." };
  const version = process.env.META_API_VERSION ?? "v26.0";
  const fields = "media_type,media_url,permalink,caption,timestamp,children{media_type,media_url}";
  const posts: IgPost[] = [];
  let after: string | null = null;
  for (let page = 0; page < (since ? MAX_PAGES : UNDATED_PAGES); page++) {
    const url = new URL(`https://graph.facebook.com/${version}/${igUser}`);
    const media = `media${after ? `.after(${after})` : ""}.limit(${PAGE_SIZE}){${fields}}`;
    url.searchParams.set("fields", `business_discovery.username(${username}){${media}}`);
    url.searchParams.set("access_token", token);
    let read: ReturnType<typeof parseMediaPage>;
    let usage = 0;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      usage = metaUsage(res.headers.get("x-app-usage"));
      read = parseMediaPage(await res.json());
    } catch (error) {
      return { posts, error: error instanceof Error ? error.message : "Request failed." };
    }
    if (read.error) return { posts, error: read.error };
    posts.push(...read.posts);
    const oldest = read.posts.at(-1)?.timestamp;
    if (!read.after || (since && oldest && new Date(oldest) < since)) break;
    if (usage >= USAGE_CEILING) return { posts, error: `stopped early to stay within Meta's hourly limit (${usage}% used)` };
    after = read.after;
  }
  return { posts, error: null };
}
