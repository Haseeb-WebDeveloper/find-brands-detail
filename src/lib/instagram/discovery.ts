export type IgProfile = {
  username: string;
  name: string | null;
  biography: string | null;
  website: string | null;
  followers: number;
  mediaCount: number;
  profilePictureUrl: string | null;
  recentMedia: { mediaType: string; mediaUrl: string | null; permalink: string; caption: string | null; timestamp: string }[];
};

export type Discovery =
  | { ok: true; profile: IgProfile }
  | { ok: false; reason: "not_business" | "token" | "rate_limited" | "error"; message: string };

type RawMedia = { media_type?: string; media_url?: string; permalink?: string; caption?: string; timestamp?: string };
type Raw = {
  business_discovery?: {
    username?: string;
    name?: string;
    biography?: string;
    website?: string;
    followers_count?: number;
    media_count?: number;
    profile_picture_url?: string;
    media?: { data?: RawMedia[] };
  };
  error?: { message?: string; code?: number };
};

export function parseDiscovery(json: unknown): Discovery {
  const raw = (json ?? {}) as Raw;
  if (raw.error) {
    const message = raw.error.message ?? "";
    const code = raw.error.code;
    if (code === 110 || /invalid user id/i.test(message)) {
      return { ok: false, reason: "not_business", message: "Not a business or creator account, or it doesn't exist." };
    }
    if (code === 190 || /access token/i.test(message)) return { ok: false, reason: "token", message: "The Meta token is missing or expired." };
    if (code === 4 || code === 17 || code === 32 || code === 613 || /limit/i.test(message)) {
      return { ok: false, reason: "rate_limited", message: "Meta's hourly limit was reached." };
    }
    return { ok: false, reason: "error", message: message || "Meta returned an error." };
  }
  const d = raw.business_discovery;
  if (!d?.username) return { ok: false, reason: "error", message: "Meta returned no profile." };
  return {
    ok: true,
    profile: {
      username: d.username,
      name: d.name ?? null,
      biography: d.biography ?? null,
      website: d.website ?? null,
      followers: d.followers_count ?? 0,
      mediaCount: d.media_count ?? 0,
      profilePictureUrl: d.profile_picture_url ?? null,
      recentMedia: (d.media?.data ?? []).map((m) => ({
        mediaType: m.media_type ?? "UNKNOWN",
        mediaUrl: m.media_url ?? null,
        permalink: m.permalink ?? "",
        caption: m.caption ?? null,
        timestamp: m.timestamp ?? "",
      })),
    },
  };
}

const FIELDS =
  "username,name,biography,website,followers_count,media_count,profile_picture_url,media.limit(12){media_type,media_url,permalink,caption,timestamp}";

/** One Business Discovery call, as the business account in META_IG_USER_ID. Never throws. */
export async function lookupBusiness(username: string): Promise<Discovery> {
  const token = process.env.META_ACCESS_TOKEN;
  const igUser = process.env.META_IG_USER_ID;
  if (!token || !igUser) return { ok: false, reason: "token", message: "The Meta token is missing or expired." };
  const version = process.env.META_API_VERSION ?? "v26.0";
  const url = new URL(`https://graph.facebook.com/${version}/${igUser}`);
  url.searchParams.set("fields", `business_discovery.username(${username}){${FIELDS}}`);
  url.searchParams.set("access_token", token);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    return parseDiscovery(await res.json());
  } catch (error) {
    return { ok: false, reason: "error", message: error instanceof Error ? error.message : "Request failed." };
  }
}
