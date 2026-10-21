import { describe, expect, it, vi } from "vitest";
import { researchCampaigns, type CampaignsDeps } from "@/lib/campaigns/research";
import type { FetchedPage } from "@/lib/website/judge";
import type { ImageCheckResult } from "@/lib/images/check-image";

const page = (url: string, html: string, ok = true): FetchedPage => ({ requestedUrl: url, ok, status: ok ? 200 : 404, finalUrl: url, html, error: null, elapsedMs: 1 });

const PAGES: Record<string, string> = {
  "https://tirtir.global/blogs/press/v": `<title>V&YOU</title><meta property="og:image" content="https://tirtir.global/v.jpg"><article><p>TIRTIR named V its global ambassador.</p></article>`,
  "https://tirtir.global/tour": `<title>The First Light</title><article><p>A moving pop-up world tour.</p></article>`,
  "https://www.rollingstone.com/v": `<title>V x TIRTIR</title><meta property="og:image" content="https://rs.com/v.jpg"><p>V fronts TIRTIR.</p>`,
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
  } satisfies CampaignsDeps;
}

const input = {
  brand: "TIRTIR",
  site: "tirtir.global",
  brandDomains: ["tirtir.global"],
  instagram: { handle: "tirtir_global", posts: [{ mediaType: "IMAGE", mediaUrl: "https://scontent.cdninstagram.com/tour.jpg", caption: "The First Light world tour" }] },
};
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
    expect(v.images.find((i) => i.candidate.url === "https://rs.com/v.jpg")?.verdict.score).toBe("review");
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

  it("returns nothing when the search finds nothing", async () => {
    const d = deps();
    d.search.mockResolvedValueOnce(null);
    expect(await researchCampaigns(input, d)).toEqual([]);
  });
});
