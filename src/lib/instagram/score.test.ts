import { describe, expect, it } from "vitest";
import { GLOBAL_SUFFIXES, nameVariants } from "@/lib/instagram/variants";
import { chooseInstagram, namedRegional, scoreInstagram, type IgCandidate } from "@/lib/instagram/score";
import type { IgProfile } from "@/lib/instagram/discovery";

const profile = (over: Partial<IgProfile>): IgProfile => ({
  username: "x",
  name: null,
  biography: null,
  website: null,
  followers: 100_000,
  mediaCount: 100,
  profilePictureUrl: null,
  recentMedia: [],
  ...over,
});

const cand = (over: Partial<IgCandidate> & { handle: string; followers?: number; name?: string }): IgCandidate => {
  const { followers, name, ...rest } = over;
  return {
    foundOn: [],
    verified: null,
    bio: { reached: null, via: null },
    discovery: { ok: true, profile: profile({ username: over.handle, followers: followers ?? 100_000, name: name ?? null }) },
    ...rest,
  };
};

describe("nameVariants", () => {
  it("builds a few likely handles from the brand name", () => {
    expect(nameVariants("TIRTIR")).toEqual(["tirtir", "tirtir_official", "tirtir_global", "tirtir.global", "tirtir.official"]);
    expect(nameVariants("Dr. Althea")[0]).toBe("dralthea");
    expect(nameVariants("Dr.G").slice(0, 5)).toEqual(["drg", "dr.g", "dr_g", "drg_official", "dr.g_official"]);
    expect(nameVariants("TIRTIR", GLOBAL_SUFFIXES)).toEqual(["tirtir_global", "tirtir.global"]);
  });
});

describe("scoreInstagram", () => {
  it("proves a business account the brand's site links", () => {
    const c = cand({ handle: "tirtir_global", foundOn: [{ url: "https://tirtir.global", region: "global" }] });
    expect(scoreInstagram(c, 810_000)).toEqual({ score: "proven", reason: "Linked from tirtir.global." });
  });

  it("proves one whose bio reaches the brand's site, even unlinked", () => {
    const c = cand({ handle: "dr.g_official", bio: { reached: "dr-g.co.kr", via: "https://linktr.ee/drg_global" } });
    expect(scoreInstagram(c, 65_000).score).toBe("proven");
  });

  it("reviews an account nothing ties to the brand", () => {
    expect(scoreInstagram(cand({ handle: "somebymi_x" }), 100_000)).toMatchObject({ score: "review" });
  });

  it("rejects a non-business account (the @haruharu_wonder impostor)", () => {
    const c = cand({ handle: "haruharu_wonder", discovery: { ok: false, reason: "not_business", message: "Not a business or creator account, or it doesn't exist." } });
    expect(scoreInstagram(c, 242_000)).toEqual({ score: "rejected", reason: "Not a business or creator account, or it doesn't exist." });
  });

  it("rejects a tiny account next to a big one (the @numbuzin squatter)", () => {
    expect(scoreInstagram(cand({ handle: "numbuzin", followers: 26 }), 232_000)).toMatchObject({ score: "rejected" });
  });

  it("reviews when Meta couldn't answer, rather than rejecting", () => {
    const c = cand({ handle: "x", discovery: { ok: false, reason: "rate_limited", message: "Meta's hourly limit was reached." } });
    expect(scoreInstagram(c, 0)).toMatchObject({ score: "review" });
  });
});

describe("namedRegional", () => {
  it("reads a region code ending the handle, or a region spelled out", () => {
    expect(namedRegional(cand({ handle: "pyunkangyul_us_official" }))).toBe(true);
    expect(namedRegional(cand({ handle: "brand.kr" }))).toBe(true);
    expect(namedRegional(cand({ handle: "brand", name: "Brand USA" }))).toBe(true);
    expect(namedRegional(cand({ handle: "usbrand", name: "Kremlin Beauty" }))).toBe(false);
    expect(namedRegional(cand({ handle: "made_in_heaven", name: "Made in Heaven · My Skin" }))).toBe(false);
    expect(namedRegional(cand({ handle: "brandkorea_official" }))).toBe(true);
    expect(namedRegional(cand({ handle: "busan_glow", name: "Phenomenal Skin from Busan" }))).toBe(false);
    expect(namedRegional(cand({ handle: "brand_global", name: "Brand US & Global" }))).toBe(false);
  });
});

describe("chooseInstagram", () => {
  it("prefers the account linked from the global site, then a 'Global' name, then followers", () => {
    const kr = cand({ handle: "tirtir_official", followers: 387_000, foundOn: [{ url: "https://tirtir.co.kr", region: "kr" }] });
    const global = cand({ handle: "tirtir_global", followers: 810_000, foundOn: [{ url: "https://tirtir.global", region: "global" }] });
    const scored = [kr, global].map((c) => ({ candidate: c, verdict: scoreInstagram(c, 810_000) }));
    expect(chooseInstagram(scored)?.handle).toBe("tirtir_global");

    const a = cand({ handle: "numbuzin_official", followers: 116_000, bio: { reached: "numbuzin.com", via: "x" } });
    const b = cand({ handle: "numbuzin_global", name: "official | numbuzin global", followers: 232_000, bio: { reached: "numbuzin.com", via: "x" } });
    expect(chooseInstagram([a, b].map((c) => ({ candidate: c, verdict: scoreInstagram(c, 232_000) })))?.handle).toBe("numbuzin_global");
  });

  it("ranks an account named for one region below the main one, whatever its followers", () => {
    const kr = cand({ handle: "brand_kr", followers: 500_000, bio: { reached: "brand.com", via: "x" } });
    const main = cand({ handle: "brand", followers: 200_000, bio: { reached: "brand.com", via: "x" } });
    expect(chooseInstagram([kr, main].map((c) => ({ candidate: c, verdict: scoreInstagram(c, 500_000) })))?.handle).toBe("brand");

    // Pyunkang Yul (2026-10-22): the US site links the US account; the global one is found by name.
    const us = cand({ handle: "pyunkangyul_us_official", followers: 60_000, foundOn: [{ url: "https://pyunkangyul.us", region: "us" }] });
    const global = cand({ handle: "pyunkangyul_global", followers: 130_084, bio: { reached: "pyunkangyulglobal.com", via: "x" } });
    expect(chooseInstagram([us, global].map((c) => ({ candidate: c, verdict: scoreInstagram(c, 130_084) })))?.handle).toBe("pyunkangyul_global");
  });

  it("falls back to the best review candidate, and to nothing", () => {
    const r = cand({ handle: "maybe" });
    expect(chooseInstagram([{ candidate: r, verdict: scoreInstagram(r, 100_000) }])?.handle).toBe("maybe");
    expect(chooseInstagram([])).toBeNull();
  });
});
