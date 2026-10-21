import { describe, expect, it } from "vitest";
import { validateCampaignInput } from "@/lib/review/campaign-input";

describe("validateCampaignInput", () => {
  it("needs a title and a description within 500 characters", () => {
    expect(validateCampaignInput({ title: " ", description: "x" })).toBe("Give the campaign a title.");
    expect(validateCampaignInput({ title: "A", description: "" })).toBe("Write a description.");
    expect(validateCampaignInput({ title: "A", description: "x".repeat(501) })).toBe("The description is 501 characters; the DB takes at most 500.");
    expect(validateCampaignInput({ title: "A", description: "Fine." })).toBeNull();
  });
});
