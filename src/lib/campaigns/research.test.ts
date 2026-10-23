import { describe, expect, it, vi } from "vitest";
import { NO_MODEL_NOTE, isKnownCampaign, researchCampaigns, writeDescriptions, type CampaignsDeps } from "@/lib/campaigns/research";
import type { FetchedPage } from "@/lib/website/judge";
import type { ImageCheckResult } from "@/lib/images/check-image";

const page = (url: string, html: string, ok = true): FetchedPage => ({ requestedUrl: url, ok, status: ok ? 200 : 404, finalUrl: url, html, error: null, elapsedMs: 1 });

const PAGES: Record<string, string> = {
  "https://tirtir.global/blogs/press/v": `<title>V&YOU</title><meta property="og:image" content="https://tirtir.global/v.jpg"><article><p>TIRTIR named V its global ambassador for Let's Radiate.</p></article>`,
  "https://tirtir.global/tour": `<title>TIRTIR: The First Light</title><article><p>A moving pop-up world tour.</p></article>`,
  "https://www.rollingstone.com/v": `<title>V x TIRTIR</title><meta property="og:image" content="https://rs.com/v.jpg"><p>V fronts TIRTIR's Radiate campaign.</p>`,
};

function deps() {
  return {
    search: vi.fn(
      async (_prompt: string): Promise<string | null> =>
        JSON.stringify({
          campaigns: [
            { title: "V&YOU: Let's Radiate", date: "2025-11", sources: ["https://tirtir.global/blogs/press/v", "https://www.rollingstone.com/v"] },
            { title: "Invented", date: "2025-01", sources: ["https://tirtir.global/404"] },
            { title: "World Tour; The First Light", date: "2025-12", sources: ["https://tirtir.global/404b", "https://tirtir.global/tour"] },
          ],
        }),
    ),
    // In the order the campaigns were kept: V&YOU, then World Tour.
    write: vi.fn(async (_prompt: string): Promise<string | null> => JSON.stringify({ descriptions: ["V fronts TIRTIR's first global campaign.", "A pop-up world tour."] })),
    fetchPage: vi.fn(async (url: string) => (PAGES[url] ? page(url, PAGES[url]) : page(url, "", false))),
    checkImage: vi.fn(
      async (url: string): Promise<ImageCheckResult> => ({ url, slot: "campaign", ok: true, status: 200, width: 1000, height: 1180, passesMin: true, minDimension: 800 }),
    ),
    loadPosts: vi.fn(async (_since: Date | null) => ({
      posts: [{ mediaType: "IMAGE", images: ["https://scontent.cdninstagram.com/tour.jpg"], caption: "The First Light world tour", timestamp: "2025-12-02T10:00:00+0000", permalink: "" }],
      error: null as string | null,
    })),
    searchImages: vi.fn(async (_query: string) => ({
      hits: [
        { url: "https://cdn.pinimg.com/unrelated.jpg", page: "https://pinterest.com/x", title: "Skincare moodboard", width: 1200, height: 1500 },
        { url: "https://mag.com/the-first-light-tour.jpg", page: "https://mag.com/tirtir-tour", title: "TIRTIR's world tour, The First Light", width: 1080, height: 1350 },
      ],
      engine: "DuckDuckGo" as string | null,
    })),
    searchDescribe: vi.fn(async (_prompt: string, _log: unknown): Promise<string | null> => null),
  } satisfies CampaignsDeps;
}

const input = { brand: "TIRTIR", site: "tirtir.global", brandDomains: ["tirtir.global"], instagram: { handle: "tirtir_global" } };
const NOW = new Date("2026-10-21T00:00:00Z");

describe("researchCampaigns", () => {
  it("keeps campaigns with a source page that loads, newest first, with brand images chosen", async () => {
    const d = deps();
    const r = await researchCampaigns(input, d, undefined, NOW);
    expect(r.map((c) => c.title)).toEqual(["World Tour; The First Light", "V&YOU: Let's Radiate"]);
    const v = r[1];
    expect(v.sources).toEqual(["https://tirtir.global/blogs/press/v", "https://www.rollingstone.com/v"]);
    expect(v.description).toBe("V fronts TIRTIR's first global campaign.");
    expect(v.chosen?.url).toBe("https://tirtir.global/v.jpg");
    // The brand's own page had a usable image, so the press page's images aren't even downloaded.
    expect(v.images.some((i) => i.candidate.url === "https://rs.com/v.jpg")).toBe(false);
    // The tour page has no image of its own; the matching Instagram post supplies one.
    expect(r[0].chosen?.source.kind).toBe("instagram");
    expect(r[0].sources).toEqual(["https://tirtir.global/tour"]);
  });

  it("re-asks a description over 500 characters, then cuts it", async () => {
    const d = deps();
    d.write.mockResolvedValueOnce(JSON.stringify({ descriptions: ["Long sentence. ".repeat(40), "x"] }));
    d.write.mockResolvedValueOnce("Still long. ".repeat(60));
    const r = await researchCampaigns(input, d, undefined, NOW);
    const v = r.find((c) => c.title.startsWith("V&YOU"));
    expect(v?.description.length).toBeLessThanOrEqual(500);
    expect(v?.descriptionNote).toBe("Shortened to fit 500 characters; check the ending.");
  });

  it("asks again for a description the model skipped", async () => {
    const d = deps();
    d.write.mockResolvedValueOnce(JSON.stringify({ descriptions: ["V fronts TIRTIR's first global campaign.", ""] }));
    d.write.mockResolvedValueOnce(JSON.stringify({ descriptions: ["A pop-up world tour."] }));
    const r = await researchCampaigns(input, d, undefined, NOW);
    expect(r.find((c) => c.title.startsWith("World"))?.description).toBe("A pop-up world tour.");
    expect(d.write).toHaveBeenCalledTimes(2);
  });

  it("drops a campaign only an Instagram caption mentions", async () => {
    const d = deps();
    d.fetchPage.mockImplementation(async (url: string) => (url === "https://tirtir.global/tour" ? page(url, "", false) : PAGES[url] ? page(url, PAGES[url]) : page(url, "", false)));
    d.write.mockResolvedValueOnce(JSON.stringify({ descriptions: ["V fronts TIRTIR's first global campaign."] }));
    const r = await researchCampaigns(input, d, undefined, NOW);
    expect(r.map((c) => c.title)).toEqual(["V&YOU: Let's Radiate"]);
  });

  it("reads Instagram back to a month before the oldest dated campaign", async () => {
    const d = deps();
    await researchCampaigns(input, d, undefined, NOW);
    // Oldest campaign: "Invented", 2025-01 → from 2024-12-01.
    expect(d.loadPosts).toHaveBeenCalledWith(new Date("2024-12-01T00:00:00Z"));
  });

  it("searches images only when the brand's own pages and posts give nothing usable", async () => {
    const d = deps();
    await researchCampaigns(input, d, undefined, NOW);
    // V&YOU has its own page's image, World Tour its Instagram post: no search.
    expect(d.searchImages).not.toHaveBeenCalled();

    const none = deps();
    none.loadPosts.mockResolvedValue({ posts: [], error: null });
    const r = await researchCampaigns(input, none, undefined, NOW);
    expect(none.searchImages).toHaveBeenCalledWith("TIRTIR World Tour; The First Light campaign");
    // The result naming the campaign is used; the unrelated one isn't even checked.
    expect(r.find((c) => c.title.startsWith("World"))?.chosen?.url).toBe("https://mag.com/the-first-light-tour.jpg");
    expect(none.checkImage).not.toHaveBeenCalledWith("https://cdn.pinimg.com/unrelated.jpg");
  });

  it("returns nothing when the search finds nothing", async () => {
    const d = deps();
    d.search.mockResolvedValueOnce(null);
    expect(await researchCampaigns(input, d)).toEqual([]);
  });

  it("looking for more, skips the campaigns the brand already has", async () => {
    const d = deps();
    const r = await researchCampaigns({ ...input, known: ["V&YOU — Let's Radiate"] }, d, undefined, NOW);
    expect(r.map((c) => c.title)).toEqual(["World Tour; The First Light"]);
    expect(d.search.mock.calls[0][0]).toContain(`list only OTHER campaigns, not these: "V&YOU — Let's Radiate"`);
  });

  it("says so when everything it lists is already here", async () => {
    const d = deps();
    const lines: string[] = [];
    const r = await researchCampaigns({ ...input, known: ["V&YOU: Let's Radiate", "Invented", "World Tour; The First Light"] }, d, async (m) => void lines.push(m), NOW);
    expect(r).toEqual([]);
    expect(lines).toContain("No new campaigns found: the ones listed are already here. Add more by hand during review.");
  });
});

describe("isKnownCampaign", () => {
  it("matches the same title written differently, or one inside the other", () => {
    expect(isKnownCampaign("V&YOU: Let's Radiate", ["v&you — let's radiate"])).toBe(true);
    expect(isKnownCampaign("Mochi Musk Launch", ["Mochi Musk"])).toBe(true);
    expect(isKnownCampaign("Rose Magnitude", ["Pacific Rock Flower"])).toBe(false);
    expect(isKnownCampaign("Rose", ["Rose Magnitude"])).toBe(false);
  });
});

describe("writeDescriptions", () => {
  const items = [
    { title: "Lucky One", date: "2024-03", text: "Lucky One launch with Cannes visuals. Shot on the Croisette.", sources: ["https://hfcparis.com/lucky"] },
    { title: "Venice", date: "2026-09", text: "Banner.", sources: ["https://hfcparis.com/venice"] },
  ];

  it("searches the web for the ones the pages were too thin for", async () => {
    const d = deps();
    d.write.mockResolvedValueOnce(JSON.stringify({ descriptions: ["Lucky One, launched in Cannes.", ""] }));
    d.write.mockResolvedValueOnce(JSON.stringify({ descriptions: [""] }));
    d.searchDescribe.mockResolvedValueOnce(JSON.stringify({ descriptions: ["A Venice Film Festival perfumery experience."] }));
    const w = await writeDescriptions("HFC", items, d);
    expect(w.map((x) => x.description)).toEqual(["Lucky One, launched in Cannes.", "A Venice Film Festival perfumery experience."]);
    expect(d.searchDescribe).toHaveBeenCalledTimes(1);
    expect(d.searchDescribe.mock.calls[0][0]).toContain("1. Venice (2026-09)");
  });

  it("says no model could answer, instead of leaving them empty without a word", async () => {
    const d = deps();
    d.write.mockResolvedValue(null);
    const lines: string[] = [];
    const w = await writeDescriptions("HFC", items, d, async (m) => void lines.push(m));
    expect(w).toEqual([
      { description: "", descriptionNote: NO_MODEL_NOTE },
      { description: "", descriptionNote: NO_MODEL_NOTE },
    ]);
    expect(lines.at(-1)).toBe(`Couldn't write the campaign descriptions. ${NO_MODEL_NOTE}`);
    // Every model is over its limit: no point asking again, or searching.
    expect(d.write).toHaveBeenCalledTimes(1);
    expect(d.searchDescribe).not.toHaveBeenCalled();
  });
});
