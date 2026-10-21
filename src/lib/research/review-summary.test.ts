import { describe, expect, it } from "vitest";
import { reviewSummary } from "@/lib/research/review-summary";

describe("reviewSummary", () => {
  it("counts fields with no proven selection", () => {
    expect(reviewSummary({ website: "proven", instagram: "proven", tiktok: null, logo: "review", cover: "proven" })).toEqual({
      count: 2,
      message: "2 of 5 fields need a look: TikTok, logo.",
      level: "warn",
    });
    expect(reviewSummary({ website: "proven", instagram: "proven", tiktok: "proven", logo: "review", cover: "proven" }).message).toBe(
      "1 of 5 fields needs a look: logo.",
    );
  });

  it("says so when everything is proven", () => {
    expect(reviewSummary({ website: "proven", instagram: "proven", tiktok: "proven", logo: "proven", cover: "proven" })).toEqual({
      count: 0,
      message: "All 5 fields are proven.",
      level: "good",
    });
  });
});
