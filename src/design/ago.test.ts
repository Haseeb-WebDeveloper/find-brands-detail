import { describe, expect, it } from "vitest";
import { sayAgo } from "./ago";

const NOW = Date.parse("2026-10-15T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;

describe("sayAgo", () => {
  it("spells the time out, never 2h or 1d", () => {
    expect(sayAgo(ago(10_000), NOW)).toBe("just now");
    expect(sayAgo(ago(MIN), NOW)).toBe("1 minute ago");
    expect(sayAgo(ago(5 * MIN), NOW)).toBe("5 minutes ago");
    expect(sayAgo(ago(60 * MIN), NOW)).toBe("1 hour ago");
    expect(sayAgo(ago(12 * 60 * MIN), NOW)).toBe("12 hours ago");
    expect(sayAgo(ago(30 * 60 * MIN), NOW)).toBe("yesterday");
    expect(sayAgo(ago(3 * 24 * 60 * MIN), NOW)).toBe("3 days ago");
  });

  it("gives the date after a week, and nothing for a bad date", () => {
    expect(sayAgo(ago(10 * 24 * 60 * MIN), NOW)).not.toMatch(/ago/);
    expect(sayAgo("not a date", NOW)).toBe("");
  });
});
