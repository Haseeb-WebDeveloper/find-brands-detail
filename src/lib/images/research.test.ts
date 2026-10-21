import { describe, expect, it, vi } from "vitest";
import { collectImages, type ImagesInput } from "@/lib/images/collect";
import { researchImages } from "@/lib/images/research";
import type { ImageCheckResult } from "@/lib/images/check-image";
import type { PageFacts } from "@/lib/website/extract";

const facts = (over: Partial<PageFacts>): PageFacts => ({
  title: null,
  siteName: null,
  description: null,
  instagram: [],
  tiktok: [],
  regionalSites: [],
  lang: null,
  ogImage: null,
  icons: [],
  logoImages: [],
  jsonLdLogos: [],
  ...over,
});

const input: ImagesInput = {
  pages: [
    {
      url: "https://jumiso.us/",
      facts: facts({
        jsonLdLogos: ["https://jumiso.us/ld.png"],
        logoImages: ["https://jumiso.us/ld.png", "https://jumiso.us/img.png"],
        icons: ["https://jumiso.us/icon.png"],
        ogImage: "https://jumiso.us/og.png",
      }),
    },
  ],
  instagram: { handle: "jumiso_global", picture: "https://scontent.cdninstagram.com/pic.jpg?oe=6716A1B0", posts: ["https://scontent.cdninstagram.com/post.jpg?oe=6716A1B0"] },
  tiktok: { handle: "jumiso_global", avatar: "https://p16.tiktokcdn.com/av.jpeg?x-expires=1792500000" },
};

describe("collectImages", () => {
  it("lists site logos first, then Instagram and TikTok pictures; covers from og:image then posts", () => {
    const all = collectImages(input);
    expect(all.filter((c) => c.slot === "logo").map((c) => c.url)).toEqual([
      "https://jumiso.us/ld.png",
      "https://jumiso.us/img.png",
      "https://scontent.cdninstagram.com/pic.jpg?oe=6716A1B0",
      "https://p16.tiktokcdn.com/av.jpeg?x-expires=1792500000",
      "https://jumiso.us/icon.png",
    ]);
    expect(all.filter((c) => c.slot === "cover").map((c) => c.source.kind)).toEqual(["site", "instagram"]);
    expect(all.find((c) => c.url.includes("pic.jpg"))?.source.label).toBe("@jumiso_global's Instagram profile picture");
  });
});

describe("researchImages", () => {
  it("checks every candidate and chooses per slot", async () => {
    const sizes: Record<string, [number, number]> = {
      "https://jumiso.us/ld.png": [372, 112],
      "https://jumiso.us/img.png": [199, 60],
      "https://jumiso.us/icon.png": [180, 180],
      "https://jumiso.us/og.png": [1200, 628],
    };
    const checkImage = vi.fn(async (url: string, slot: "logo" | "cover"): Promise<ImageCheckResult> => {
      const [w, h] = sizes[url] ?? [1000, 1000];
      const min = slot === "logo" ? 256 : 800;
      return { url, slot, ok: true, status: 200, width: w, height: h, passesMin: Math.max(w, h) >= min, minDimension: min };
    });
    const r = await researchImages(input, { checkImage }, undefined, new Date("2026-10-21T00:00:00Z"));
    expect(checkImage).toHaveBeenCalledTimes(7);
    expect(r.cover.chosen?.url).toBe("https://jumiso.us/og.png");
    // Every logo is review or rejected (wide wordmark, small, expiring CDN links): the squarest review wins.
    expect(r.logo.chosen?.source.kind).toBe("instagram");
  });
});
