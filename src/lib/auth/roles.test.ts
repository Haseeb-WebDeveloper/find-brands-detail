import { describe, expect, it } from "vitest";
import { can } from "@/lib/auth/roles";

describe("roles", () => {
  it("lets owners do everything", () => {
    for (const p of ["batches:read", "batches:write", "team:read", "team:write"] as const) {
      expect(can("owner", p)).toBe(true);
    }
  });

  it("lets members research but not manage the team", () => {
    expect(can("member", "batches:read")).toBe(true);
    expect(can("member", "batches:write")).toBe(true);
    expect(can("member", "team:read")).toBe(true);
    expect(can("member", "team:write")).toBe(false);
  });
});
