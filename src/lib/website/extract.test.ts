import { describe, expect, it } from "vitest";
import { extractFacts } from "@/lib/website/extract";

const html = `<!doctype html><html><head>
<title>TIRTIR Global Official</title>
<meta property="og:site_name" content="TIRTIR">
<meta property="og:image" content="/cdn/hero.jpg">
<meta name="description" content="Mask Fit cushions">
<link rel="apple-touch-icon" href="/icons/touch.png">
<link rel="alternate" hreflang="ko" href="https://www.tirtir.co.kr/">
<script type="application/ld+json">{"@type":"Organization","logo":"https://tirtir.global/logo.svg","sameAs":["https://www.instagram.com/tirtir_global/"]}</script>
<script>var cfg = {"social":"https:\\/\\/www.tiktok.com\\/@tirtir.official"};</script>
</head><body>
<header><img class="site-logo" data-src="/img/logo.png" alt="TIRTIR"></header>
<a href="https://www.instagram.com/tirtir_global/">IG</a>
<a href="https://instagram.com/p/ABC123/">a post</a>
<a href="https://www.instagram.com/explore/tags/kbeauty/">tag</a>
<a href="https://us.tirtir.global/">US store</a>
<a href="https://www.sephora.com/brand/tirtir">Sephora</a>
<a href="https://tirtir.global/pages/about">About</a>
</body></html>`;

describe("extractFacts", () => {
  const facts = extractFacts(html, "https://tirtir.global/", "TIRTIR");

  it("reads title, site name, description", () => {
    expect(facts).toMatchObject({ title: "TIRTIR Global Official", siteName: "TIRTIR", description: "Mask Fit cushions" });
  });

  it("finds profile handles, including JSON-escaped and JSON-LD sameAs links, but not posts or tags", () => {
    expect(facts.instagram).toEqual(["tirtir_global"]);
    expect(facts.tiktok).toEqual(["tirtir.official"]);
  });

  it("finds regional brand sites and skips retailers and its own origin", () => {
    expect(facts.regionalSites.sort()).toEqual(["https://us.tirtir.global", "https://www.tirtir.co.kr"]);
  });

  it("resolves image candidates to absolute URLs", () => {
    expect(facts.ogImage).toBe("https://tirtir.global/cdn/hero.jpg");
    expect(facts.icons).toEqual(["https://tirtir.global/icons/touch.png"]);
    expect(facts.logoImages).toEqual(["https://tirtir.global/img/logo.png"]);
    expect(facts.jsonLdLogos).toEqual(["https://tirtir.global/logo.svg"]);
  });
});
