import { afterEach, describe, expect, it } from "vitest";
import { requireEnv } from "@/lib/env";

afterEach(() => {
  delete process.env.TEST_VAR;
});

describe("requireEnv", () => {
  it("returns the value", () => {
    process.env.TEST_VAR = "value";
    expect(requireEnv("TEST_VAR")).toBe("value");
  });

  it("names the missing variable", () => {
    expect(() => requireEnv("TEST_VAR")).toThrow("TEST_VAR is not set. See .env.example.");
  });

  it("treats blank as missing", () => {
    process.env.TEST_VAR = "  ";
    expect(() => requireEnv("TEST_VAR")).toThrow("TEST_VAR is not set");
  });
});
