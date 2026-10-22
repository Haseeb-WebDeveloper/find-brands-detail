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
  brand: "Jumiso",
  brandDomains: ["jumiso.us"],
  pages: [
    {
      url: "https://jumiso.us/",
      facts: facts({
        jsonLdLogos: ["https://jumiso.us/ld.png"],
        logoImages: ["https://jumiso.us/ld.png", "https://jumiso.us/img.png"],
        icons: ["https://jumiso.us/icon.png"],
        ogImage: "https://jumiso.us/og.png",
        bannerImages: ["https://jumiso.us/hero-1.jpg", "https://jumiso.us/hero-2.jpg", "https://jumiso.us/hero-3.jpg"],
      }),
    },
  ],
  instagram: { handle: "jumiso_global", picture: "https://scontent.cdninstagram.com/pic.jpg?oe=6716A1B0", posts: ["https://scontent.cdninstagram.com/post.jpg?oe=6716A1B0"] },
  tiktok: { handle: "jumiso_global", avatar: "https://p16.tiktokcdn.com/av.jpeg?x-expires=1792500000" },
};

describe("collectImages", () => {
  it("lists site logos first, then Instagram and TikTok pictures; covers from the first banners, og:image, other banners, then posts", () => {
    const all = collectImages(input);
    expect(all.filter((c) => c.slot === "logo").map((c) => c.url)).toEqual([
      "https://jumiso.us/ld.png",
      "https://jumiso.us/img.png",
      "https://scontent.cdninstagram.com/pic.jpg?oe=6716A1B0",
      "https://p16.tiktokcdn.com/av.jpeg?x-expires=1792500000",
      "https://jumiso.us/icon.png",
    ]);
    expect(all.filter((c) => c.slot === "cover").map((c) => c.url)).toEqual([
      "https://jumiso.us/hero-1.jpg",
      "https://jumiso.us/hero-2.jpg",
      "https://jumiso.us/og.png",
      "https://jumiso.us/hero-3.jpg",
      "https://scontent.cdninstagram.com/post.jpg?oe=6716A1B0",
    ]);
    expect(all.find((c) => c.url.includes("pic.jpg"))?.source.label).toBe("@jumiso_global's Instagram profile picture");
  });
});

const noSearch = vi.fn(async (_q: string, _o: { wide?: boolean }) => ({ hits: [], engine: null as string | null }));

describe("researchImages", () => {
  it("checks every candidate and chooses per slot", async () => {
    const sizes: Record<string, [number, number]> = {
      "https://jumiso.us/ld.png": [372, 112],
      "https://jumiso.us/img.png": [199, 60],
      "https://jumiso.us/icon.png": [180, 180],
      "https://jumiso.us/og.png": [1200, 628],
      // Banners: a wide hero, a square tile, a too-small strip.
      "https://jumiso.us/hero-1.jpg": [2000, 1000],
      "https://jumiso.us/hero-2.jpg": [1000, 1000],
      "https://jumiso.us/hero-3.jpg": [700, 200],
    };
    const checkImage = vi.fn(async (url: string, slot: "logo" | "cover"): Promise<ImageCheckResult> => {
      const [w, h] = sizes[url] ?? [1000, 1000];
      const min = slot === "logo" ? 256 : 800;
      return { url, slot, ok: true, status: 200, width: w, height: h, passesMin: Math.max(w, h) >= min, minDimension: min };
    });
    const r = await researchImages(input, { checkImage, searchImages: noSearch }, undefined, new Date("2026-10-21T00:00:00Z"));
    expect(checkImage).toHaveBeenCalledTimes(10);
    // The 2000×1000 hero and the 1200×628 share image fit the 16:11 frame about as well; the bigger wins.
    expect(r.cover.chosen?.url).toBe("https://jumiso.us/hero-1.jpg");
    // The brand gave a usable cover, so no image search.
    expect(noSearch).not.toHaveBeenCalled();
    // Every logo is review or rejected (wide wordmark, small, expiring CDN links): the squarest review wins.
    expect(r.logo.chosen?.source.kind).toBe("instagram");
  });

  it("searches wide images for a cover only when the brand's pages give none", async () => {
    const checkImage = vi.fn(async (url: string, slot: "logo" | "cover"): Promise<ImageCheckResult> => {
      const [w, h] = url.includes("search") ? [1600, 1100] : [800, 1000];
      return { url, slot, ok: true, status: 200, width: w, height: h, passesMin: true, minDimension: 800 };
    });
    const searchImages = vi.fn(async (_q: string, _o: { wide?: boolean }) => ({
      hits: [
        { url: "https://shop.com/search-unrelated.jpg", page: "https://shop.com/a", title: "Skincare sale", width: 1600, height: 1100 },
        { url: "https://news.com/search-jumiso.jpg", page: "https://news.com/jumiso", title: "Jumiso launches in the UK", width: 1600, height: 1100 },
      ],
      engine: "DuckDuckGo" as string | null,
    }));
    const r = await researchImages({ ...input, instagram: null, tiktok: null }, { checkImage, searchImages }, undefined, new Date("2026-10-21T00:00:00Z"));
    expect(searchImages).toHaveBeenCalledWith("Jumiso campaign banner", { wide: true });
    expect(r.cover.chosen?.url).toBe("https://news.com/search-jumiso.jpg");
    expect(checkImage).not.toHaveBeenCalledWith("https://shop.com/search-unrelated.jpg", "cover");
  });
});
