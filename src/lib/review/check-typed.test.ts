import { describe, expect, it, vi } from "vitest";
import { checkTyped, type TypedDeps } from "@/lib/review/check-typed";
import type { ImageCheckResult } from "@/lib/images/check-image";

function deps() {
  return {
    brand: "numbuzin",
    fetchPage: vi.fn(async (url: string) => ({ requestedUrl: url, ok: true, status: 200, finalUrl: url, html: "<title>numbuzin</title>", error: null, elapsedMs: 1 })),
    judgeSite: vi.fn(() => ({ score: "proven" as const, kind: "ok" as const, reason: "Loads and names the brand.", siteUrl: "https://numbuzin.com/" })),
    lookupBusiness: vi.fn(async () => ({
      ok: true as const,
      profile: { username: "numbuzin_global", name: "numbuzin", biography: null, website: null, followers: 232000, mediaCount: 1, profilePictureUrl: null, recentMedia: [] },
    })),
    lookupProfile: vi.fn(async () => ({ ok: false as const, reason: "blocked" as const, message: "TikTok didn't show the profile, so it couldn't be checked." })),
    checkImage: vi.fn(
      async (url: string, slot: "logo" | "cover" | "campaign"): Promise<ImageCheckResult> => ({ url, slot, ok: true, status: 200, width: 1000, height: 1000, passesMin: true, minDimension: 256 }),
    ),
  } satisfies TypedDeps;
}

describe("checkTyped", () => {
  it("checks a website like research does", async () => {
    expect(await checkTyped("website", "numbuzin.com", deps())).toMatchObject({ value: "https://numbuzin.com/", score: "proven", reason: "Typed by a reviewer. Loads and names the brand." });
  });

  it("normalises and checks an Instagram handle or link", async () => {
    const r = await checkTyped("instagram", "https://www.instagram.com/numbuzin_global/", deps());
    expect(r).toMatchObject({ value: "numbuzin_global", score: "proven" });
    expect(r.reason).toContain("232,000 followers");
  });

  it("keeps a TikTok handle TikTok won't show as needing a look", async () => {
    expect(await checkTyped("tiktok", "@numbuzin_global", deps())).toMatchObject({ value: "numbuzin_global", score: "review" });
  });

  it("checks an image address at the importer's minimum", async () => {
    const d = deps();
    expect(await checkTyped("logo", "https://numbuzin.com/logo.png", d)).toMatchObject({ score: "proven", reason: "Typed by a reviewer. 1000×1000." });
    d.checkImage.mockResolvedValueOnce({ url: "x", slot: "cover", ok: true, status: 200, width: 400, height: 300, passesMin: false, minDimension: 800 });
    expect((await checkTyped("cover", "https://x.com/small.jpg", d)).score).toBe("rejected");
  });

  it("rejects what isn't an address or a handle", async () => {
    expect((await checkTyped("logo", "not a url", deps())).score).toBe("rejected");
    expect((await checkTyped("instagram", "has spaces in it", deps())).score).toBe("rejected");
  });
});
