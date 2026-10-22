import type { Discovery } from "@/lib/instagram/discovery";

export type IgCandidate = {
  handle: string;
  foundOn: { url: string; region: "global" | "us" | "kr" | "other" }[];
  discovery: Discovery;
  verified: boolean | null;
  bio: { reached: string | null; via: string | null };
};

export type IgVerdict = { score: "proven" | "review" | "rejected"; reason: string };

/** Under this share of the biggest candidate's followers, an account is a squatter (spec §7). */
const TINY_SHARE = 0.05;

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Spec §7, Instagram. The badge is evidence only and never changes the score. */
export function scoreInstagram(c: IgCandidate, maxFollowers: number): IgVerdict {
  if (!c.discovery.ok) {
    return c.discovery.reason === "not_business"
      ? { score: "rejected", reason: c.discovery.message }
      : { score: "review", reason: `Couldn't check: ${c.discovery.message}` };
  }
  const p = c.discovery.profile;
  if (maxFollowers > 0 && p.followers < maxFollowers * TINY_SHARE) {
    return { score: "rejected", reason: `Only ${p.followers.toLocaleString("en-US")} followers next to a ${maxFollowers.toLocaleString("en-US")}-follower candidate.` };
  }
  if (c.foundOn.length > 0) return { score: "proven", reason: `Linked from ${host(c.foundOn[0].url)}.` };
  if (c.bio.reached) return { score: "proven", reason: `Bio link reaches ${c.bio.reached}.` };
  return { score: "review", reason: "Exists, but nothing ties it to the brand." };
}

const followers = (c: IgCandidate) => (c.discovery.ok ? c.discovery.profile.followers : 0);
const fromGlobal = (c: IgCandidate) => c.foundOn.some((f) => f.region === "global");
const namedGlobal = (c: IgCandidate) => (c.discovery.ok ? /global/i.test(`${c.discovery.profile.name ?? ""} ${c.handle}`) : false);

/** A region as a word in the display name: "Brand USA", "Brand Korea". */
const REGION_IN_NAME = /\b(usa|america|korea|japan|china|europe|france|germany|canada|australia|india|singapore|malaysia|thailand|vietnam|indonesia|taiwan|mexico|brasil|brazil|mena|latam)\b/i;
/** A region run into a handle (@brandkorea_official): only long names, which don't hide inside other words. */
const REGION_IN_HANDLE = /korea|japan|america|europe|canada|australia|singapore|malaysia|thailand|vietnam|indonesia|taiwan|mexico|brasil|brazil/i;
/** A two-letter (or "usa") code ending a handle, alone or before "official": @brand_us, @brand.kr, @brand_us_official. */
const REGION_CODE = /[._](us|usa|kr|jp|cn|uk|eu|fr|de|ca|au|in|sg|my|th|vn|ph|id|tw|hk|mx|br|uae|ksa)([._]official)?$/i;

/** A regional account: a region in its handle or name, unless it also says "global". */
export function namedRegional(c: IgCandidate): boolean {
  if (namedGlobal(c)) return false;
  const name = c.discovery.ok ? (c.discovery.profile.name ?? "") : "";
  return REGION_CODE.test(c.handle) || REGION_IN_HANDLE.test(c.handle) || REGION_IN_NAME.test(name);
}

/**
 * Global-site link first, then a "Global" name, then not named for one region, then followers
 * (Global Constraints: prefer the global account). The region check keeps a big regional account
 * (@brand_kr) from winning on followers over the brand's main one.
 */
export function chooseInstagram(scored: { candidate: IgCandidate; verdict: IgVerdict }[]): IgCandidate | null {
  const rank = (c: IgCandidate) => [fromGlobal(c) ? 0 : 1, namedGlobal(c) ? 0 : 1, namedRegional(c) ? 1 : 0, -followers(c)];
  const better = (a: IgCandidate, b: IgCandidate) => {
    const [x, y] = [rank(a), rank(b)];
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i];
    return false;
  };
  for (const level of ["proven", "review"] as const) {
    const pool = scored.filter((s) => s.verdict.score === level).map((s) => s.candidate);
    if (pool.length > 0) return pool.reduce((best, c) => (better(c, best) ? c : best));
  }
  return null;
}
