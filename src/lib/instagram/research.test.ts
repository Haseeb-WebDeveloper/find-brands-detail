import { describe, expect, it, vi } from "vitest";
import { researchInstagram, type InstagramDeps } from "@/lib/instagram/research";
import type { Discovery } from "@/lib/instagram/discovery";
import type { PageFacts } from "@/lib/website/extract";

const facts = (instagram: string[]): PageFacts => ({
  title: null,
  siteName: null,
  description: null,
  instagram,
  tiktok: [],
  regionalSites: [],
  lang: null,
  ogImage: null,
  icons: [],
  logoImages: [],
  jsonLdLogos: [],
});

const ok = (username: string, followers: number, name: string | null = null, website: string | null = null): Discovery => ({
  ok: true,
  profile: { username, name, biography: null, website, followers, mediaCount: 10, profilePictureUrl: null, recentMedia: [] },
});

function deps(profiles: Record<string, Discovery>) {
  return {
    lookupBusiness: vi.fn(
      async (u: string): Promise<Discovery> =>
        profiles[u] ?? { ok: false, reason: "not_business", message: "Not a business or creator account, or it doesn't exist." },
    ),
    fetchBadge: vi.fn(async () => true),
    checkBioLink: vi.fn(async (website: string | null) => ({ reached: website ? "tirtir.global" : null, via: website })),
  } satisfies InstagramDeps;
}

describe("researchInstagram", () => {
  it("chooses the handle the global site links, over the Korean site's", async () => {
    const d = deps({ tirtir_global: ok("tirtir_global", 810_543), tirtir_official: ok("tirtir_official", 387_000) });
    const r = await researchInstagram(
      {
        brand: "TIRTIR",
        brandDomains: ["tirtir.global", "tirtir.co.kr"],
        pages: [
          { url: "https://www.tirtir.co.kr", region: "kr", facts: facts(["tirtir_official"]) },
          { url: "https://tirtir.global", region: "global", facts: facts(["tirtir_global"]) },
        ],
      },
      d,
    );
    expect(r.chosen?.handle).toBe("tirtir_global");
    expect(r.scored.every((s) => s.verdict.score === "proven")).toBe(true);
    expect(d.lookupBusiness).toHaveBeenCalledTimes(2);
  });

  it("tries name variants only when no linked handle is a business account", async () => {
    const d = deps({ numbuzin_global: ok("numbuzin_global", 232_000, "numbuzin", "https://linktr.ee/numbuzin") });
    const r = await researchInstagram(
      { brand: "numbuzin", brandDomains: ["numbuzin.com"], pages: [{ url: "https://numbuzin.com", region: "kr", facts: facts(["numbuzin"]) }] },
      d,
    );
    expect(d.lookupBusiness).toHaveBeenCalledWith("numbuzin");
    expect(d.lookupBusiness).toHaveBeenCalledWith("numbuzin_global");
    expect(r.chosen?.handle).toBe("numbuzin_global");
    expect(r.scored.find((s) => s.candidate.handle === "numbuzin")?.verdict.score).toBe("rejected");
  });

  it("never exceeds the lookup budget", async () => {
    const many = Array.from({ length: 12 }, (_, i) => `handle${i}`);
    const d = deps({});
    await researchInstagram({ brand: "Acme", brandDomains: [], pages: [{ url: "https://acme.com", region: "global", facts: facts(many) }] }, d);
    expect(d.lookupBusiness.mock.calls.length).toBeLessThanOrEqual(8);
  });
});
