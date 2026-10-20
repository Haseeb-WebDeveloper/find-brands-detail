import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/auth/safe-next";

describe("safeNext", () => {
  it("keeps same-origin paths", () => {
    expect(safeNext("/batches/abc")).toBe("/batches/abc");
  });

  it("refuses anything that could leave the site", () => {
    expect(safeNext("https://evil.example")).toBe("/batches");
    expect(safeNext("//evil.example")).toBe("/batches");
    expect(safeNext("/\\evil.example")).toBe("/batches");
    expect(safeNext(null)).toBe("/batches");
  });

  it("never sends a signed-in user back to login", () => {
    expect(safeNext("/login")).toBe("/batches");
    expect(safeNext("/login?next=/x")).toBe("/batches");
  });
});
