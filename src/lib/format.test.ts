import { describe, expect, it } from "vitest";
import { formatShortDate } from "@/lib/format";

describe("formatShortDate", () => {
  it("formats day and month", () => {
    expect(formatShortDate("2026-10-16T12:00:00Z")).toBe("Oct 16");
  });

  it("returns empty for invalid input", () => {
    expect(formatShortDate("not a date")).toBe("");
  });
});
