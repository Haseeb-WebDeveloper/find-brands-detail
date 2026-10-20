import type { TtLookup } from "@/lib/tiktok/profile";

export type TtCandidate = {
  handle: string;
  foundOn: { url: string; region: "global" | "us" | "kr" | "other"; kind: "site" | "instagram-bio" }[];
  lookup: TtLookup;
  bio: { reached: string | null; via: string | null };
  sameBioAsInstagram: boolean;
};

export type TtVerdict = { score: "proven" | "review" | "rejected"; reason: string };

/** Under this share of the biggest candidate's followers, an account is an impostor (spec §7). */
const TINY_SHARE = 0.05;
/** An account found only by name with fewer followers than this is a squatter, even alone (spec §7). */
const SQUATTER_FOLLOWERS = 100;

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Two links to the same page, however they were written ("linktr.ee/Jumiso?utm…" = "https://linktr.ee/jumiso/"). */
export function sameLink(a: string | null, b: string | null): boolean {
  const norm = (u: string | null) =>
    u
      ? u
          .toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .replace(/[?#].*$/, "")
          .replace(/\/+$/, "")
      : null;
  const [x, y] = [norm(a), norm(b)];
  return x !== null && x === y;
}

/** Spec §7, TikTok. The badge is evidence only and never changes the score. */
export function scoreTiktok(c: TtCandidate, maxFollowers: number): TtVerdict {
  if (!c.lookup.ok) {
    return c.lookup.reason === "not_found" ? { score: "rejected", reason: c.lookup.message } : { score: "review", reason: `Couldn't check: ${c.lookup.message}` };
  }
  const p = c.lookup.profile;
  if (maxFollowers > 0 && p.followers < maxFollowers * TINY_SHARE) {
    return { score: "rejected", reason: `Only ${p.followers.toLocaleString("en-US")} followers next to a ${maxFollowers.toLocaleString("en-US")}-follower candidate.` };
  }
  const site = c.foundOn.find((f) => f.kind === "site");
  if (site) return { score: "proven", reason: `Linked from ${host(site.url)}.` };
  const bioPage = c.foundOn.find((f) => f.kind === "instagram-bio");
  if (bioPage) return { score: "proven", reason: `Linked from the brand's Instagram bio page (${host(bioPage.url)}).` };
  if (c.bio.reached) return { score: "proven", reason: `Bio link reaches ${c.bio.reached}.` };
  if (c.sameBioAsInstagram) return { score: "proven", reason: "Bio link is the same page as the brand's Instagram bio." };
  if (p.followers < SQUATTER_FOLLOWERS) {
    return { score: "rejected", reason: `Only ${p.followers.toLocaleString("en-US")} followers, and nothing ties it to the brand.` };
  }
  return { score: "review", reason: "Exists, but nothing ties it to the brand." };
}

const followers = (c: TtCandidate) => (c.lookup.ok ? c.lookup.profile.followers : 0);
const fromGlobal = (c: TtCandidate) => c.foundOn.some((f) => f.region === "global");
const namedGlobal = (c: TtCandidate) => (c.lookup.ok ? /global/i.test(`${c.lookup.profile.name ?? ""} ${c.handle}`) : false);

/**
 * Global link first, then a "Global" name, then followers — the Instagram rule (Global Constraints).
 * An account that couldn't be read and that nothing links is never chosen: it is only a guessed name.
 */
export function chooseTiktok(scored: { candidate: TtCandidate; verdict: TtVerdict }[]): TtCandidate | null {
  const rank = (c: TtCandidate) => [fromGlobal(c) ? 0 : 1, namedGlobal(c) ? 0 : 1, -followers(c)];
  const better = (a: TtCandidate, b: TtCandidate) => {
    const [x, y] = [rank(a), rank(b)];
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i];
    return false;
  };
  for (const level of ["proven", "review"] as const) {
    const pool = scored.filter((s) => s.verdict.score === level && (s.candidate.lookup.ok || s.candidate.foundOn.length > 0)).map((s) => s.candidate);
    if (pool.length > 0) return pool.reduce((best, c) => (better(c, best) ? c : best));
  }
  return null;
}
