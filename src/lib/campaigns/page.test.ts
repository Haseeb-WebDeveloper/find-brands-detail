import { describe, expect, it } from "vitest";
import { readCampaignPage } from "@/lib/campaigns/page";

const html = `<html><head><title>V&YOU campaign</title><meta name="description" content="TIRTIR's global campaign with V.">
<meta property="og:image" content="/og.jpg"><meta name="twitter:image" content="https://cdn.x.com/tw.jpg"></head>
<body><header><img src="/logo.svg"><img src="/icons/cart.png"></header>
<article><p>TIRTIR named V its global ambassador.</p><img srcset="/a-400.jpg 400w, /a-1600.jpg 1600w" src="/a-400.jpg"><img src="/b.gif"><img data-src="/c.jpg" alt="campaign visual"></article></body></html>`;

describe("readCampaignPage", () => {
  it("lists share images first, then the largest article images, skipping icons, logos and gifs", () => {
    const r = readCampaignPage(html, "https://tirtir.global/blogs/press/v");
    expect(r.images).toEqual(["https://tirtir.global/og.jpg", "https://cdn.x.com/tw.jpg", "https://tirtir.global/a-1600.jpg", "https://tirtir.global/c.jpg"]);
  });

  it("reads lazy-loaded images, <picture> sources and JSON-LD, and skips declared thumbnails", () => {
    const page = `<html><head><script type="application/ld+json">{"@graph":[{"@type":"NewsArticle","image":{"url":"https://cdn.x.com/lead.jpg"}}]}</script></head>
<body><main>
<img src="/placeholder.png" data-src="/lazy.jpg">
<img data-srcset="/l-600.jpg 600w, /l-1800.jpg 1800w" src="/blank.png">
<picture><source srcset="/p-800.webp 800w, /p-2000.webp 2000w"><img src="/p-800.jpg"></picture>
<img src="/thumb.jpg" width="120" height="120">
</main></body></html>`;
    expect(readCampaignPage(page, "https://mag.com/a").images).toEqual([
      "https://cdn.x.com/lead.jpg",
      "https://mag.com/lazy.jpg",
      "https://mag.com/l-1800.jpg",
      "https://mag.com/p-2000.webp",
      "https://mag.com/p-800.jpg",
    ]);
  });

  it("puts images whose description, caption or file name names the campaign first", () => {
    const page = `<html><head><meta property="og:image" content="/share.jpg"></head><body><article>
<img src="/unrelated.jpg" alt="Our latest store opening">
<figure><img src="/key.jpg"><figcaption>The Red Cushion campaign, shot in Seoul</figcaption></figure>
<img src="/red-cushion-campaign-02.jpg">
</article></body></html>`;
    expect(readCampaignPage(page, "https://tirtir.global/p", ["cushion"]).images).toEqual([
      "https://tirtir.global/key.jpg",
      "https://tirtir.global/red-cushion-campaign-02.jpg",
      "https://tirtir.global/share.jpg",
      "https://tirtir.global/unrelated.jpg",
    ]);
  });

  it("keeps a short text excerpt to write the description from", () => {
    const r = readCampaignPage(html, "https://tirtir.global/blogs/press/v");
    expect(r.text).toContain("V&YOU campaign");
    expect(r.text).toContain("TIRTIR named V its global ambassador.");
  });
});
