import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  it("allows up to the limit within the window", () => {
    const key = `t:${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 60_000, 1_000).ok).toBe(true);
    expect(rateLimit(key, 3, 60_000, 1_000)).toEqual({ ok: false, retryAfterSeconds: 60 });
  });

  it("resets after the window", () => {
    const key = `t:${Math.random()}`;
    for (let i = 0; i < 3; i++) rateLimit(key, 3, 60_000, 1_000);
    expect(rateLimit(key, 3, 60_000, 61_001).ok).toBe(true);
  });
});
