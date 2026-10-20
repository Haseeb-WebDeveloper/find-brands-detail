import { describe, expect, it } from "vitest";

describe("toolchain", () => {
  it("loads test env", () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://test.supabase.co");
  });
});
