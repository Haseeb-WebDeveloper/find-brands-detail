import { describe, expect, it } from "vitest";
import { CENTRED, FRAME_ASPECT, formatFraming, frameRegion, parseFraming } from "@/lib/images/framing";

describe("frameRegion", () => {
  it("is the importer's centre crop without a framing", () => {
    // 1000×1000 into the campaign tile: the full height, 847 wide, centred.
    expect(frameRegion(1000, 1000, FRAME_ASPECT.campaign)).toEqual({ left: 77, top: 0, width: 847, height: 1000 });
    expect(frameRegion(1600, 1000, FRAME_ASPECT.cover, CENTRED)).toEqual({ left: 73, top: 0, width: 1455, height: 1000 });
  });

  it("zooms in on the point it is centred on, never past the image's edge", () => {
    expect(frameRegion(1000, 1000, FRAME_ASPECT.campaign, { zoom: 2, x: 0.5, y: 0.5 })).toEqual({ left: 288, top: 250, width: 424, height: 500 });
    expect(frameRegion(1000, 1000, FRAME_ASPECT.campaign, { zoom: 2, x: 0, y: 0 })).toEqual({ left: 0, top: 0, width: 424, height: 500 });
    expect(frameRegion(1000, 1000, FRAME_ASPECT.campaign, { zoom: 2, x: 1, y: 1 })).toEqual({ left: 576, top: 500, width: 424, height: 500 });
  });

  it("keeps zoom between 1 and the maximum", () => {
    expect(frameRegion(1000, 1000, 1, { zoom: 0.2, x: 0.5, y: 0.5 })).toEqual({ left: 0, top: 0, width: 1000, height: 1000 });
    expect(frameRegion(1000, 1000, 1, { zoom: 50, x: 0.5, y: 0.5 }).width).toBe(200);
  });
});

describe("parseFraming / formatFraming", () => {
  it("reads and writes the CSV cell", () => {
    expect(parseFraming("")).toBeNull();
    expect(parseFraming(" 1.4, 0.5,0.32 ")).toEqual({ zoom: 1.4, x: 0.5, y: 0.32 });
    expect(formatFraming({ zoom: 1.4004, x: 0.5, y: 0.31999 })).toBe("1.4,0.5,0.32");
  });

  it("refuses what isn't a framing", () => {
    for (const bad of ["abc", "1,2", "0.5,0.5,0.5", "1,1.2,0", "1,0,-0.1", "6,0.5,0.5"]) expect(parseFraming(bad)).toBe("invalid");
  });
});
