import { describe, expect, it, vi } from "vitest";
import { researchTiktok, type TiktokDeps } from "@/lib/tiktok/research";
import type { TtLookup } from "@/lib/tiktok/profile";
import type { PageFacts } from "@/lib/website/extract";

const facts = (tiktok: string[]): PageFacts => ({
  title: null,
  siteName: null,
  description: null,
  instagram: [],
  tiktok,
  regionalSites: [],
  lang: null,
  ogImage: null,
  icons: [],
  logoImages: [],
  jsonLdLogos: [],
});

const ok = (username: string, followers: number, bioLink: string | null = null, name: string | null = null): TtLookup => ({
  ok: true,
  profile: { username, name, verified: false, bioLink, signature: null, followers, private: false },
});

function deps(profiles: Record<string, TtLookup>, linkPage: string[] = []) {
  return {
    lookupProfile: vi.fn(async (h: string): Promise<TtLookup> => profiles[h] ?? { ok: false, reason: "not_found", message: "No TikTok account by this name." }),
    readLinkPage: vi.fn(async (_url: string) => linkPage),
    checkBioLink: vi.fn(async (_website: string | null, _domains: string[], _brand: string) => ({ reached: null, via: null })),
  } satisfies TiktokDeps;
}

describe("researchTiktok", () => {
  it("proves the account the Instagram bio page links", async () => {
    const d = deps({ "tirtir.official": ok("tirtir.official", 900_900), tirtir_official: ok("tirtir_official", 2) }, ["tirtir.official"]);
    const r = await researchTiktok(
      { brand: "TIRTIR", brandDomains: ["tirtir.global"], pages: [], instagram: { handle: "tirtir_global", website: "https://linktr.ee/TIRTIRGLOBAL" } },
      d,
    );
    expect(d.readLinkPage).toHaveBeenCalledWith("https://linktr.ee/TIRTIRGLOBAL");
    expect(r.chosen?.handle).toBe("tirtir.official");
    expect(r.scored.find((s) => s.candidate.handle === "tirtir.official")?.verdict.score).toBe("proven");
  });

  it("tries the Instagram handle first when nothing links an account", async () => {
    const d = deps({ bentoncosmetic: ok("bentoncosmetic", 28_000, "https://beacons.page/bentoncosmetic_official", "Benton Global") });
    const r = await researchTiktok(
      { brand: "Benton", brandDomains: ["benton.co.kr"], pages: [], instagram: { handle: "bentoncosmetic", website: "https://beacons.page/bentoncosmetic_official" } },
      d,
    );
    expect(d.lookupProfile.mock.calls[0][0]).toBe("bentoncosmetic");
    expect(r.chosen?.handle).toBe("bentoncosmetic");
    expect(r.scored.find((s) => s.candidate.handle === "bentoncosmetic")?.verdict.reason).toBe("Bio link is the same page as the brand's Instagram bio.");
  });

  it("uses handles the brand's sites link", async () => {
    const d = deps({ "celimax.global": ok("celimax.global", 229_100) });
    const r = await researchTiktok(
      { brand: "Celimax", brandDomains: ["celimax.com"], pages: [{ url: "https://celimax.com/", region: "global", facts: facts(["celimax.global"]) }], instagram: null },
      d,
    );
    expect(r.chosen?.handle).toBe("celimax.global");
    expect(d.lookupProfile).toHaveBeenCalledTimes(1);
  });

  it("stops trying names after TikTok blocks a lookup", async () => {
    const d = deps({});
    d.lookupProfile.mockResolvedValue({ ok: false, reason: "blocked", message: "TikTok didn't show the profile, so it couldn't be checked." });
    await researchTiktok({ brand: "Acme", brandDomains: [], pages: [], instagram: null }, d);
    expect(d.lookupProfile).toHaveBeenCalledTimes(1);
  });

  it("never exceeds the lookup budget", async () => {
    const many = Array.from({ length: 12 }, (_, i) => `handle${i}`);
    const d = deps({});
    await researchTiktok({ brand: "Acme", brandDomains: [], pages: [{ url: "https://acme.com", region: "global", facts: facts(many) }], instagram: null }, d);
    expect(d.lookupProfile.mock.calls.length).toBeLessThanOrEqual(8);
  });
});
