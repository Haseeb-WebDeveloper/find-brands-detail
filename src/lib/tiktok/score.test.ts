import { describe, expect, it } from "vitest";
import { chooseTiktok, sameLink, scoreTiktok, type TtCandidate } from "@/lib/tiktok/score";

const cand = (handle: string, over: Partial<TtCandidate> & { followers?: number; name?: string } = {}): TtCandidate => {
  const { followers, name, ...rest } = over;
  return {
    handle,
    foundOn: [],
    bio: { reached: null, via: null },
    sameBioAsInstagram: false,
    lookup: { ok: true, profile: { username: handle, name: name ?? null, verified: false, bioLink: null, signature: null, followers: followers ?? 100_000, private: false } },
    ...rest,
  };
};

describe("sameLink", () => {
  it("ignores scheme, www, trailing slash, query and case", () => {
    expect(sameLink("https://linktr.ee/Jumiso?utm_source=x", "linktr.ee/jumiso/")).toBe(true);
    expect(sameLink("http://www.beacons.page/benton", "https://beacons.page/benton")).toBe(true);
    expect(sameLink("https://linktr.ee/a", "https://linktr.ee/b")).toBe(false);
    expect(sameLink(null, "https://linktr.ee/a")).toBe(false);
  });
});

describe("scoreTiktok", () => {
  it("proves an account the brand's site links", () => {
    const v = scoreTiktok(cand("celimax.global", { foundOn: [{ url: "https://celimax.com/", region: "global", kind: "site" }] }), 100_000);
    expect(v).toEqual({ score: "proven", reason: "Linked from celimax.com." });
  });

  it("proves an account the Instagram bio page links", () => {
    const v = scoreTiktok(cand("tirtir.official", { foundOn: [{ url: "https://linktr.ee/TIRTIRGLOBAL", region: "global", kind: "instagram-bio" }] }), 100_000);
    expect(v).toEqual({ score: "proven", reason: "Linked from the brand's Instagram bio page (linktr.ee)." });
  });

  it("proves an account whose bio link reaches the brand or matches the Instagram bio", () => {
    expect(scoreTiktok(cand("a", { bio: { reached: "jumiso.us", via: "https://linktr.ee/jumiso" } }), 100_000).score).toBe("proven");
    expect(scoreTiktok(cand("bentoncosmetic", { sameBioAsInstagram: true }), 100_000)).toEqual({
      score: "proven",
      reason: "Bio link is the same page as the brand's Instagram bio.",
    });
  });

  it("rejects a missing account and a tiny one next to a big candidate", () => {
    expect(scoreTiktok(cand("x", { lookup: { ok: false, reason: "not_found", message: "No TikTok account by this name." } }), 0).score).toBe("rejected");
    expect(scoreTiktok(cand("tirtir_official", { followers: 2 }), 900_000).score).toBe("rejected");
  });

  it("rejects a tiny account found only by name, even when it is the only candidate", () => {
    expect(scoreTiktok(cand("roundaround_official", { followers: 18 }), 18)).toEqual({
      score: "rejected",
      reason: "Only 18 followers, and nothing ties it to the brand.",
    });
    expect(scoreTiktok(cand("aestura", { followers: 472 }), 472).score).toBe("review");
  });

  it("sends a name-only match or a blocked check to review", () => {
    expect(scoreTiktok(cand("benton"), 100_000).score).toBe("review");
    const blocked = scoreTiktok(cand("x", { lookup: { ok: false, reason: "blocked", message: "TikTok didn't show the profile, so it couldn't be checked." } }), 0);
    expect(blocked).toEqual({ score: "review", reason: "Couldn't check: TikTok didn't show the profile, so it couldn't be checked." });
  });
});

describe("chooseTiktok", () => {
  it("prefers a global link, then a global name, then followers", () => {
    const kr = cand("brand_kr", { followers: 900_000, foundOn: [{ url: "https://brand.co.kr", region: "kr", kind: "site" }] });
    const gl = cand("brand.global", { followers: 50_000, foundOn: [{ url: "https://linktr.ee/brand", region: "global", kind: "instagram-bio" }] });
    const scored = [kr, gl].map((c) => ({ candidate: c, verdict: scoreTiktok(c, 900_000) }));
    expect(chooseTiktok(scored)?.handle).toBe("brand.global");
  });

  it("never chooses a guessed name that couldn't be read, but keeps a linked one", () => {
    const blocked = { ok: false, reason: "blocked", message: "x" } as const;
    const guess = cand("roundaround_official", { lookup: blocked });
    expect(chooseTiktok([{ candidate: guess, verdict: scoreTiktok(guess, 0) }])).toBeNull();
    const linked = cand("dr.g_global", { lookup: blocked, foundOn: [{ url: "https://linktr.ee/drg_global", region: "global", kind: "instagram-bio" }] });
    expect(chooseTiktok([{ candidate: linked, verdict: scoreTiktok(linked, 0) }])?.handle).toBe("dr.g_global");
  });

  it("falls back to review candidates and returns null when all are rejected", () => {
    const r = cand("benton");
    expect(chooseTiktok([{ candidate: r, verdict: { score: "review", reason: "" } }])?.handle).toBe("benton");
    expect(chooseTiktok([{ candidate: r, verdict: { score: "rejected", reason: "" } }])).toBeNull();
  });
});
