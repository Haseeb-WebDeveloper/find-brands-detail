import { describe, expect, it } from "vitest";
import { RESEARCH_STEPS, stepNumber } from "@/lib/research/steps";
import { batchTopic, brandTopic } from "@/lib/realtime/channels";
import { brandResearchEvent } from "@/lib/inngest/events";

describe("RESEARCH_STEPS", () => {
  it("follows the spec's order", () => {
    expect(RESEARCH_STEPS.map((s) => s.id)).toEqual(["website", "crawl", "instagram", "tiktok", "images", "campaigns", "details", "score"]);
  });

  it("numbers steps from 1", () => {
    expect(stepNumber("website")).toBe(1);
    expect(stepNumber("score")).toBe(8);
    expect(stepNumber("nope")).toBe(0);
  });
});

describe("topics and events", () => {
  it("names private channels by id", () => {
    expect(batchTopic("b1")).toBe("batch:b1");
    expect(brandTopic("x9")).toBe("brand:x9");
  });

  it("builds a research event carrying only the brand id", () => {
    const id = "6f1c2b9e-1d2a-4c3b-9a8e-0f1e2d3c4b5a";
    expect(brandResearchEvent(id)).toEqual({ name: "brand/research.requested", data: { brandId: id } });
    expect(() => brandResearchEvent("not-a-uuid")).toThrow();
  });
});
