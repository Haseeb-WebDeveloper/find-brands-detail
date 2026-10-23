import { describe, expect, it } from "vitest";
import { cleanFraming, storedFraming } from "@/lib/review/framing-input";

describe("cleanFraming", () => {
  it("keeps a framing at the CSV's precision", () => {
    expect(cleanFraming({ zoom: 1.40449, x: 0.500049, y: 0.31999 })).toEqual({ ok: true, framing: { zoom: 1.4, x: 0.5, y: 0.32 } });
  });

  it("stores the centre crop, or nothing, as null", () => {
    expect(cleanFraming({ zoom: 1, x: 0.5, y: 0.5 })).toEqual({ ok: true, framing: null });
    expect(cleanFraming(null)).toEqual({ ok: true, framing: null });
  });

  it("refuses what the importer would refuse", () => {
    for (const bad of [{ zoom: 0.5, x: 0.5, y: 0.5 }, { zoom: 1, x: 2, y: 0 }, { zoom: "1", x: 0, y: 0 }, "1,0.5,0.5", { zoom: Number.NaN, x: 0, y: 0 }]) {
      expect(cleanFraming(bad)).toEqual({ ok: false });
    }
  });
});

describe("storedFraming", () => {
  it("reads a JSON column, ignoring anything that isn't a framing", () => {
    expect(storedFraming({ zoom: 2, x: 0.3, y: 0.7 })).toEqual({ zoom: 2, x: 0.3, y: 0.7 });
    expect(storedFraming(null)).toBeNull();
    expect(storedFraming({ junk: true })).toBeNull();
  });
});
