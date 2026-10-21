import { describe, expect, it } from "vitest";
import { cutToSentence, describePrompt, parseDescriptions } from "@/lib/campaigns/describe";

describe("parseDescriptions", () => {
  it("reads one description per campaign, in order, null where missing", () => {
    const text = 'Sure: {"descriptions":["First one.", "", "Third."]}';
    expect(parseDescriptions(text, 3)).toEqual(["First one.", null, "Third."]);
    expect(parseDescriptions("no json", 2)).toEqual([null, null]);
  });
});

describe("cutToSentence", () => {
  it("keeps whole sentences within the limit", () => {
    const s = "A".repeat(300) + ". " + "B".repeat(300) + ".";
    expect(cutToSentence(s, 500)).toBe("A".repeat(300) + ".");
    expect(cutToSentence("Short.", 500)).toBe("Short.");
  });
});

describe("describePrompt", () => {
  it("carries each campaign's page text and the length rule", () => {
    const p = describePrompt("TIRTIR", [{ title: "V&YOU", date: "2025-11", text: "TIRTIR named V its global ambassador." }]);
    expect(p).toContain("1. V&YOU (2025-11)");
    expect(p).toContain("TIRTIR named V its global ambassador.");
    expect(p).toContain("at most 450 characters");
  });
});
