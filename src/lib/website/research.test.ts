import { describe, expect, it, vi } from "vitest";
import { chooseSite, researchWebsite, siteRegion, type CheckedSite, type WebsiteDeps } from "@/lib/website/research";
import type { FetchedPage } from "@/lib/website/judge";
import type { PageFacts } from "@/lib/website/extract";

const EMPTY_FACTS: PageFacts = {
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
};

const real = (title: string, body = "") => `<html><head><title>${title}</title></head><body>${body}${"x".repeat(3000)}</body></html>`;

function deps(pages: Record<string, Partial<FetchedPage>>, over: Partial<WebsiteDeps> = {}): WebsiteDeps {
  return {
    fetchPage: vi.fn(async (url: string) => ({
      requestedUrl: url,
      ok: true,
      status: 200,
      finalUrl: url,
      html: "",
      error: null,
      elapsedMs: 10,
      ...(pages[url] ?? { ok: false, status: null, finalUrl: null, error: "ENOTFOUND" }),
    })),
    latestSnapshot: vi.fn(async () => null),
    findOfficialSites: vi.fn(async () => []),
    ...over,
  };
}

describe("siteRegion and chooseSite", () => {
  const site = (url: string, title: string, score: "proven" | "review" = "proven", lang: string | null = null): CheckedSite => ({
    url,
    source: "search",
    verdict: { score, kind: score === "proven" ? "ok" : "name_missing", reason: "", siteUrl: url.replace(/\/$/, "") },
    facts: { ...EMPTY_FACTS, title, lang },
    archive: null,
  });

  it("reads the region from the host and the title", () => {
    expect(siteRegion(site("https://jumiso.co.kr/", "주미소(JUMISO)"))).toBe("kr");
    expect(siteRegion(site("https://pyunkangyul.com/", "편강 율 공식 온라인몰"))).toBe("kr");
    expect(siteRegion(site("https://jumiso.us/", "Jumiso US"))).toBe("us");
    expect(siteRegion(site("https://us.numbuzin.com/", "numbuzin"))).toBe("us");
    expect(siteRegion(site("https://haruharuwonder.com/", "haruharu wonder"))).toBe("global");
    expect(siteRegion(site("https://numbuzin.com/", "numbuzin", "proven", "ko"))).toBe("kr");
    expect(siteRegion(site("https://klairs.co.jp/", "dear Klairs", "proven", "ja"))).toBe("other");
    expect(siteRegion(site("https://bentoncosmetics.com/", "Benton", "proven", "en"))).toBe("global");
  });

  it("prefers a proven global site, then US, then Korean", () => {
    const kr = site("https://jumiso.co.kr/", "주미소(JUMISO)");
    const us = site("https://jumiso.us/", "Jumiso US");
    const global = site("https://haruharuwonder.com/", "haruharu wonder");
    expect(chooseSite([kr, us])).toBe(us);
    expect(chooseSite([kr, us, global])).toBe(global);
  });

  it("ranks other-language sites last", () => {
    const jp = site("https://klairs.co.jp/", "dear Klairs", "proven", "ja");
    const kr = site("https://klairs.co.kr/", "Klairs", "proven", "ko");
    expect(chooseSite([jp, kr])).toBe(kr);
  });

  it("still prefers any proven site over a site that needs a look", () => {
    const kr = site("https://klairs.co.kr/", "Klairs");
    const globalReview = site("https://www.klairscosmetics.com/", "Klairs", "review");
    expect(chooseSite([globalReview, kr])).toBe(kr);
  });
});

describe("researchWebsite", () => {
  it("proves the hint and follows its regional links", async () => {
    const d = deps({
      "https://numbuzin.com/": { html: real("numbuzin", '<a href="https://us.numbuzin.com/">US</a>') },
      "https://us.numbuzin.com/": { html: real("numbuzin US") },
    });
    const r = await researchWebsite("numbuzin", "https://numbuzin.com/", d);
    expect(r.chosen?.url).toBe("https://numbuzin.com/");
    expect(r.candidates.map((c) => [c.url, c.source, c.verdict.score])).toEqual([
      ["https://numbuzin.com/", "hint", "proven"],
      ["https://us.numbuzin.com/", "regional-link", "proven"],
    ]);
    expect(d.findOfficialSites).not.toHaveBeenCalled();
  });

  it("rejects a hijacked hint and attaches the archive, then searches", async () => {
    const d = deps(
      {
        "https://pyunkangyul.us/": { finalUrl: "https://xoilaclivettbdu.tv/", html: real("live sport") },
        "https://pyunkangyul.com/": { html: real("Pyunkang Yul") },
      },
      {
        latestSnapshot: vi.fn(async () => ({
          timestamp: "20240121170818",
          page: { requestedUrl: "", ok: true, status: 200, finalUrl: "", html: real("Pyunkang Yul US Official"), error: null, elapsedMs: 1 },
        })),
        findOfficialSites: vi.fn(async () => [{ url: "https://pyunkangyul.com", region: "global" as const }]),
      },
    );
    const r = await researchWebsite("Pyunkang Yul", "https://pyunkangyul.us/", d);
    const hint = r.candidates.find((c) => c.source === "hint")!;
    expect(hint.verdict.kind).toBe("hijacked");
    expect(hint.archive?.timestamp).toBe("20240121170818");
    expect(r.chosen?.url).toBe("https://pyunkangyul.com/");
  });

  it("searches the web when there is no hint, and chooses nothing when nothing loads", async () => {
    const d = deps({}, { findOfficialSites: vi.fn(async () => [{ url: "https://dr-g.co.kr", region: "kr" as const }]) });
    const r = await researchWebsite("Dr.G", null, d);
    expect(d.findOfficialSites).toHaveBeenCalledWith("Dr.G", expect.any(Function));
    expect(r.candidates[0].verdict.kind).toBe("unreachable");
    expect(r.chosen).toBeNull();
  });
});
