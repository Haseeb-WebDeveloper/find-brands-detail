import { describe, expect, it } from "vitest";
import { nextToReview } from "@/lib/review/next";

const s = (id: string, status = "needs_review") => ({ id, name: id, status });

describe("nextToReview", () => {
  it("goes to the next brand still to review, skipping reviewed ones", () => {
    expect(nextToReview([s("a"), s("b", "approved"), s("c"), s("d")], "a")?.id).toBe("c");
  });
  it("wraps around to the top", () => {
    expect(nextToReview([s("a"), s("b", "approved"), s("c")], "c")?.id).toBe("a");
  });
  it("is null when nothing else is left", () => {
    expect(nextToReview([s("a"), s("b", "approved"), s("c", "exported")], "a")).toBeNull();
    expect(nextToReview([s("a", "researching")], "a")).toBeNull();
  });
});
