import { describe, expect, it } from "vitest";
import { chooseImage, scoreImage, type ImageCandidate } from "@/lib/images/score";

const NOW = new Date("2026-10-21T12:00:00Z");

const cand = (over: Partial<ImageCandidate> & { w?: number; h?: number; ok?: boolean; reason?: string } = {}): ImageCandidate => {
  const { w = 1000, h = 1000, ok = true, reason, ...rest } = over;
  const slot = rest.slot ?? "logo";
  const min = slot === "logo" ? 256 : 800;
  return {
    slot,
    url: "https://jumiso.us/logo.png",
    source: { kind: "site", label: "jumiso.us" },
    expiresAt: null,
    check: { url: "x", slot, ok, status: ok ? 200 : 404, width: w, height: h, passesMin: ok && Math.max(w, h) >= min, minDimension: min, reason },
    ...rest,
  };
};

describe("scoreImage", () => {
  it("proves a big enough image from the brand's site", () => {
    expect(scoreImage(cand({ w: 600, h: 600 }), NOW)).toEqual({ score: "proven", reason: "600×600 from jumiso.us." });
  });

  it("rejects what the importer would reject", () => {
    expect(scoreImage(cand({ ok: false, reason: "Could not fetch image" }), NOW)).toEqual({ score: "rejected", reason: "Could not fetch image" });
    expect(scoreImage(cand({ w: 180, h: 180 }), NOW)).toEqual({ score: "rejected", reason: "180×180 — below the 256px minimum for a logo." });
    expect(scoreImage(cand({ slot: "cover", w: 600, h: 400 }), NOW).score).toBe("rejected");
  });

  it("sends a wide wordmark logo to review", () => {
    expect(scoreImage(cand({ w: 372, h: 112 }), NOW)).toEqual({ score: "review", reason: "372×112: too wide for the square logo frame, so it would be cropped." });
  });

  it("sends a link expiring within 7 days, or already expired, to review", () => {
    const source = { kind: "instagram", label: "@jumiso_global's Instagram profile picture" } as const;
    expect(scoreImage(cand({ source, expiresAt: new Date("2026-10-24T00:00:00Z") }), NOW)).toEqual({
      score: "review",
      reason: "1000×1000 from @jumiso_global's Instagram profile picture. The link expires on 24 Oct; export soon after review.",
    });
    expect(scoreImage(cand({ source, expiresAt: new Date("2026-10-20T00:00:00Z") }), NOW).reason).toBe(
      "1000×1000 from @jumiso_global's Instagram profile picture. The link expired on 20 Oct; re-run research for a fresh one.",
    );
  });
});

describe("chooseImage", () => {
  it("prefers proven, then the squarest logo, then the biggest", () => {
    const wide = cand({ url: "wide", w: 900, h: 300 });
    const square = cand({ url: "square", w: 400, h: 400 });
    const scored = [wide, square].map((c) => ({ candidate: c, verdict: scoreImage(c, NOW) }));
    expect(chooseImage(scored)?.url).toBe("square");
  });

  it("prefers the cover closest to 16:11", () => {
    const og = cand({ slot: "cover", url: "og", w: 1200, h: 628 });
    const portrait = cand({ slot: "cover", url: "post", w: 2574, h: 3218 });
    const scored = [portrait, og].map((c) => ({ candidate: c, verdict: scoreImage(c, NOW) }));
    expect(chooseImage(scored)?.url).toBe("og");
  });

  it("returns null when everything is rejected", () => {
    const tiny = cand({ w: 100, h: 100 });
    expect(chooseImage([{ candidate: tiny, verdict: scoreImage(tiny, NOW) }])).toBeNull();
  });
});

describe("campaign images", () => {
  it("labels a third-party page's image for review", () => {
    const c = cand({ slot: "campaign", w: 1600, h: 900, source: { kind: "third_party", label: "rollingstone.com" } });
    expect(scoreImage(c, NOW)).toEqual({ score: "review", reason: "1600×900 from rollingstone.com, a third-party page." });
  });

  it("proves a brand page's image and prefers the 200:236 shape", () => {
    const tall = cand({ slot: "campaign", url: "tall", w: 1000, h: 1180 });
    const wide = cand({ slot: "campaign", url: "wide", w: 1600, h: 900 });
    expect(scoreImage(tall, NOW).score).toBe("proven");
    expect(chooseImage([wide, tall].map((c) => ({ candidate: c, verdict: scoreImage(c, NOW) })))?.url).toBe("tall");
  });
});

describe("owner's rules (2026-10-21)", () => {
  it("rejects a portrait or square cover", () => {
    expect(scoreImage(cand({ slot: "cover", w: 1080, h: 1350 }), NOW)).toEqual({ score: "rejected", reason: "1080×1350: not a landscape image." });
    expect(scoreImage(cand({ slot: "cover", w: 1200, h: 1200 }), NOW).score).toBe("rejected");
    expect(scoreImage(cand({ slot: "cover", w: 1200, h: 628 }), NOW).score).toBe("proven");
  });

  it("chooses the Instagram profile picture for the logo, then TikTok's, over a proven site logo", () => {
    const site = cand({ url: "site", w: 600, h: 600 });
    const ig = cand({ url: "ig", source: { kind: "instagram", label: "ig" }, expiresAt: new Date("2026-10-24T00:00:00Z") });
    const tt = cand({ url: "tt", source: { kind: "tiktok", label: "tt" }, expiresAt: new Date("2026-10-24T00:00:00Z") });
    const all = [site, tt, ig].map((c) => ({ candidate: c, verdict: scoreImage(c, NOW) }));
    expect(chooseImage(all)?.url).toBe("ig");
    expect(chooseImage(all.filter((s) => s.candidate.url !== "ig"))?.url).toBe("tt");
  });
});
