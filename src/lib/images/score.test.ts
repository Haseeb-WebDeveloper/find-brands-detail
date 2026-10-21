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
