import { describe, expect, it } from "vitest";
import { STUCK_AFTER_MS, canFillAi, missingAiParts, stuckBrandIds } from "@/lib/research/ai-fill";

const full = { description: "A brand", tier: "premium", aesthetic: "clean", industry: "skincare", regions: "global" };

describe("missingAiParts", () => {
  it("finds no campaigns and empty details", () => {
    expect(missingAiParts(0, null)).toEqual({ campaigns: true, details: true });
    expect(missingAiParts(2, { ...full, tier: " " })).toEqual({ campaigns: false, details: true });
    expect(missingAiParts(3, full)).toEqual({ campaigns: false, details: false });
  });
});

describe("canFillAi", () => {
  it("only for a researched, unreviewed brand with something missing", () => {
    const missing = { campaigns: true, details: false };
    expect(canFillAi("needs_review", missing)).toBe(true);
    expect(canFillAi("approved", missing)).toBe(false);
    expect(canFillAi("researching", missing)).toBe(false);
    expect(canFillAi("needs_review", { campaigns: false, details: false })).toBe(false);
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
