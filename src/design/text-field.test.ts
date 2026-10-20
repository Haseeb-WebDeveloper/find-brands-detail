import { describe, expect, it } from "vitest";
import { cleanNumber } from "./text-field";

describe("a number field", () => {
  it("keeps digits and one decimal point", () => {
    expect(cleanNumber("1500 asd")).toBe("1500");
    expect(cleanNumber("£1,500.50")).toBe("1500.50");
    expect(cleanNumber("1.2.3")).toBe("1.23");
  });

  it("takes a minus only where a credit is allowed, and only in front", () => {
    expect(cleanNumber("-120")).toBe("120");
    expect(cleanNumber("-120", { negative: true })).toBe("-120");
    expect(cleanNumber("12-0", { negative: true })).toBe("120");
  });

  it("takes whole numbers only when asked", () => {
    expect(cleanNumber("12.5", { decimals: false })).toBe("125");
  });
});
