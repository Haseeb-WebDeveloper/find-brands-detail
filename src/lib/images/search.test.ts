import { describe, expect, it } from "vitest";
import { parseBing, parseDuckDuckGo, rankHits, type ImageHit } from "@/lib/images/search";

describe("parseDuckDuckGo", () => {
  it("reads each result's image, page, title and size", () => {
    const json = { results: [{ image: "https://a.com/1.jpg", url: "https://a.com/p", title: "TIRTIR Matcha House", width: 1080, height: 1350 }, { title: "no image" }] };
    expect(parseDuckDuckGo(json)).toEqual([{ url: "https://a.com/1.jpg", page: "https://a.com/p", title: "TIRTIR Matcha House", width: 1080, height: 1350 }]);
    expect(parseDuckDuckGo(null)).toEqual([]);
  });
});

describe("parseBing", () => {
  it("reads the JSON each result carries", () => {
    const html = `<a class="iusc" m="{&quot;murl&quot;:&quot;https://b.com/2.jpg&quot;,&quot;purl&quot;:&quot;https://b.com/p?a=1&amp;b=2&quot;,&quot;t&quot;:&quot;Matcha House pop-up&quot;}"></a><a m="{broken"></a>`;
    expect(parseBing(html)).toEqual([{ url: "https://b.com/2.jpg", page: "https://b.com/p?a=1&b=2", title: "Matcha House pop-up", width: null, height: null }]);
  });
});

describe("rankHits", () => {
  const hit = (url: string, title: string, width: number | null = 1080, height: number | null = 1350, page = "https://news.com/a"): ImageHit => ({ url, page, title, width, height });
  const owned = (u: string) => u.includes("tirtir.global");

  it("keeps results that name the campaign, the brand's own site first, then the best-fitting size", () => {
    const hits = [
      hit("https://x.com/moodboard.jpg", "Skincare moodboard"),
      hit("https://news.com/matcha-house-wide.jpg", "TIRTIR Matcha House opens", 2160, 1350),
      hit("https://news.com/matcha-house.jpg", "TIRTIR Matcha House opens"),
      hit("https://tirtir.global/matcha.jpg", "Matcha House", 1080, 1080, "https://tirtir.global/pages/matcha"),
      hit("https://news.com/matcha-house-small.jpg", "Matcha House", 400, 500),
      hit("https://encrypted-tbn0.gstatic.com/x", "Matcha House"),
    ];
    expect(rankHits(hits, ["matcha", "house"], owned, 4).map((h) => h.url)).toEqual([
      "https://tirtir.global/matcha.jpg",
      "https://news.com/matcha-house.jpg",
      "https://news.com/matcha-house-wide.jpg",
    ]);
  });

  it("finds nothing without distinctive words to match", () => {
    expect(rankHits([hit("https://a.com/1.jpg", "TIRTIR")], [], owned, 4)).toEqual([]);
  });
});
