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

  it("keeps a short text excerpt to write the description from", () => {
    const r = readCampaignPage(html, "https://tirtir.global/blogs/press/v");
    expect(r.text).toContain("V&YOU campaign");
    expect(r.text).toContain("TIRTIR named V its global ambassador.");
  });
});
