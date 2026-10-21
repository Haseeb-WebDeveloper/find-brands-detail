import { describe, expect, it } from "vitest";
import { detailsPrompt, mergeDraft, parseDetails } from "@/lib/details/draft";

describe("parseDetails", () => {
  it("keeps only the DB's words, lowercased, and a sane description", () => {
    const text = `Here:\n${JSON.stringify({
      description: "  Founded in Seoul in 2017, Jumiso makes fruit-acid skincare. It is known for its AHA and BHA toners. Positioned as an affordable everyday K-beauty brand.  ",
      tier: "Masstige",
      industry: ["Skincare", "skin care", "cosmetics"],
      aesthetic: ["Clean", "k-beauty", "fresh-faced", "playful", "gentle", "accessible"],
      regions: ["Global", "Asia", "Mars"],
    })}`;
    expect(parseDetails(text)).toEqual({
      description: "Founded in Seoul in 2017, Jumiso makes fruit-acid skincare. It is known for its AHA and BHA toners. Positioned as an affordable everyday K-beauty brand.",
      tier: "masstige",
      industry: ["skincare"],
      aesthetic: ["clean", "k-beauty", "playful", "gentle"],
      regions: ["global", "asia"],
    });
  });

  it("drops a tier outside the three and an empty answer", () => {
    expect(parseDetails(JSON.stringify({ description: "x", tier: "budget", industry: [], aesthetic: [], regions: [] }))?.tier).toBe("");
    expect(parseDetails("no json here")).toBeNull();
  });

  it("cuts an overlong description at a sentence end", () => {
    const long = `${"A sentence about the brand. ".repeat(20)}`;
    const d = parseDetails(JSON.stringify({ description: long, tier: "premium", industry: ["makeup"], aesthetic: [], regions: [] }));
    expect(d?.description.length).toBeLessThanOrEqual(400);
    expect(d?.description.endsWith(".")).toBe(true);
  });
});

describe("mergeDraft", () => {
  it("fills only what the reviewer left empty", () => {
    const current = { description: "Typed by me.", tier: "", aesthetic: "", industry: "makeup", regions: "" };
    const draft = { description: "AI text.", tier: "premium", industry: ["skincare"], aesthetic: ["clean", "gentle"], regions: ["global"] };
    expect(mergeDraft(current, draft)).toEqual({ description: "Typed by me.", tier: "premium", aesthetic: "clean|gentle", industry: "makeup", regions: "global" });
  });
});

describe("detailsPrompt", () => {
  it("names the brand, its facts and the allowed words", () => {
    const p = detailsPrompt({ brand: "Jumiso", website: "jumiso.us", instagram: { handle: "jumiso_global", followers: 135440, bio: "Skincare for real progress" }, siteText: "Jumiso — fruit acid skincare", campaigns: ["Urea Intensive Collection"] });
    expect(p).toContain('"Jumiso"');
    expect(p).toContain("jumiso.us");
    expect(p).toContain("@jumiso_global (135,440 followers)");
    expect(p).toContain("masstige");
    expect(p).toContain("skincare");
    expect(p).toContain("k-beauty");
  });
});
