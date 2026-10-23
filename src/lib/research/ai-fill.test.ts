import { describe, expect, it } from "vitest";
import { STUCK_AFTER_MS, canFillAi, fillLabel, missingAiParts, stuckBrandIds } from "@/lib/research/ai-fill";

const full = { description: "A brand", tier: "premium", aesthetic: "clean", industry: "skincare", regions: "global" };
const camp = (description = "Written.", status: "proposed" | "approved" | "removed" = "proposed") => ({ status, description });

describe("missingAiParts", () => {
  it("finds too few campaigns, empty descriptions and empty details", () => {
    expect(missingAiParts([], null)).toEqual({ campaigns: true, descriptions: false, details: true });
    expect(missingAiParts([camp(), camp(" ")], { ...full, tier: " " })).toEqual({ campaigns: true, descriptions: true, details: true });
    expect(missingAiParts([camp(), camp(), camp()], full)).toEqual({ campaigns: false, descriptions: false, details: false });
  });

  it("doesn't count removed campaigns, nor their empty descriptions", () => {
    expect(missingAiParts([camp(), camp(), camp("", "removed")], full)).toEqual({ campaigns: true, descriptions: false, details: false });
    expect(missingAiParts([camp(), camp(), camp("", "approved")], full)).toEqual({ campaigns: false, descriptions: true, details: false });
  });
});

describe("canFillAi", () => {
  it("only for a researched, unreviewed brand with something missing", () => {
    const none = { campaigns: false, descriptions: false, details: false };
    expect(canFillAi("needs_review", { ...none, campaigns: true })).toBe(true);
    expect(canFillAi("needs_review", { ...none, descriptions: true })).toBe(true);
    expect(canFillAi("approved", { ...none, campaigns: true })).toBe(false);
    expect(canFillAi("researching", { ...none, descriptions: true })).toBe(false);
    expect(canFillAi("needs_review", none)).toBe(false);
  });
});

describe("stuckBrandIds", () => {
  const now = Date.parse("2026-10-22T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms);

  it("marks a batch's unfinished brands once nothing has moved for the limit", () => {
    const brands = [
      { id: "a", status: "researching" as const, updatedAt: ago(STUCK_AFTER_MS + 60_000) },
      { id: "b", status: "queued" as const, updatedAt: ago(2 * STUCK_AFTER_MS) },
      { id: "c", status: "needs_review" as const, updatedAt: ago(5 * STUCK_AFTER_MS) },
    ];
    expect([...stuckBrandIds(brands, now)].sort()).toEqual(["a", "b"]);
  });

  it("leaves a long queue alone while another brand is moving", () => {
    const brands = [
      { id: "a", status: "researching" as const, updatedAt: ago(60_000) },
      { id: "b", status: "queued" as const, updatedAt: ago(3 * STUCK_AFTER_MS) },
    ];
    expect(stuckBrandIds(brands, now).size).toBe(0);
  });
});

describe("fillLabel", () => {
  it("names only what Fill will do", () => {
    expect(fillLabel({ campaigns: false, descriptions: true, details: false })).toBe("Write campaign descriptions");
    expect(fillLabel({ campaigns: true, descriptions: false, details: true })).toBe("Find more campaigns and draft the missing details");
    expect(fillLabel({ campaigns: true, descriptions: true, details: true })).toBe("Find more campaigns, write campaign descriptions and draft the missing details");
  });
});
