import { describe, expect, it } from "vitest";
import { progressText, progressTone } from "@/lib/brands/progress";
import type { BrandRow } from "@/lib/batches/scoped";

const base: BrandRow = { id: "b1", name: "TIRTIR", status: "queued", currentStep: null, reviewCount: 0, error: null };

describe("progressText", () => {
  it("describes each status", () => {
    expect(progressText(base)).toBe("Waiting to start");
    expect(progressText({ ...base, status: "researching", currentStep: "instagram" })).toBe("Checking Instagram (step 3 of 7)");
    expect(progressText({ ...base, status: "needs_review", reviewCount: 4 })).toBe("Ready for review · 4 need you");
    expect(progressText({ ...base, status: "needs_review" })).toBe("Ready for review");
    expect(progressText({ ...base, status: "needs_review", error: "Research stopped." })).toBe("Research stopped.");
    expect(progressText({ ...base, status: "approved" })).toBe("Approved");
    expect(progressText({ ...base, status: "exported" })).toBe("Exported");
  });
});

describe("progressTone", () => {
  it("colours by state", () => {
    expect(progressTone(base)).toBe("grey");
    expect(progressTone({ ...base, status: "researching" })).toBe("blue");
    expect(progressTone({ ...base, status: "needs_review" })).toBe("orange");
    expect(progressTone({ ...base, status: "needs_review", error: "x" })).toBe("red");
    expect(progressTone({ ...base, status: "approved" })).toBe("green");
  });
});
