import { describe, expect, it } from "vitest";
import { campaignsPrompt, parseCampaignsAnswer } from "@/lib/campaigns/find";

describe("parseCampaignsAnswer", () => {
  it("reads the model's JSON, drops social links and duplicates, caps at 8", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ title: `C${i}`, date: "2025-01", sources: [`https://a.com/${i}`] }));
    const text = `Here you go:\n${JSON.stringify({
      campaigns: [
        { title: "V&YOU: Let's Radiate", date: "2025-11", sources: ["https://www.instagram.com/p/x", "https://tirtir.global/blogs/press/v"] },
        { title: "v&you: let's radiate", date: "2025-11", sources: ["https://b.com"] },
        { title: "No date", date: "soon", sources: ["https://c.com"] },
        ...many,
      ],
    })}`;
    const r = parseCampaignsAnswer(text);
    expect(r[0]).toEqual({ title: "V&YOU: Let's Radiate", date: "2025-11", sources: ["https://tirtir.global/blogs/press/v"] });
    expect(r[1]).toEqual({ title: "No date", date: null, sources: ["https://c.com/"] });
    expect(r).toHaveLength(8);
  });

  it("skips sales and promotions, whatever the model calls them", () => {
    const text = JSON.stringify({
      campaigns: [
        { title: "Snail Mucin Essence (Ongoing Promotion)", date: null, sources: ["https://a.com"] },
        { title: "Black Friday Sale", date: null, sources: ["https://a.com"] },
        { title: "Urea Intensive Collection Launch", date: "2026-10", sources: ["https://a.com"] },
      ],
    });
    expect(parseCampaignsAnswer(text).map((c) => c.title)).toEqual(["Urea Intensive Collection Launch"]);
  });

  it("is empty for an answer without JSON", () => {
    expect(parseCampaignsAnswer("Sorry, nothing found.")).toEqual([]);
  });

  it("names the brand's site and Instagram in the prompt", () => {
    expect(campaignsPrompt({ brand: "TIRTIR", site: "tirtir.global", instagram: "tirtir_global" })).toContain("official site tirtir.global, Instagram @tirtir_global");
  });
});
