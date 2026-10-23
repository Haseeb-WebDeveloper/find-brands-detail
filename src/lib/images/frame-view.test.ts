import { describe, expect, it } from "vitest";
import { CENTRED, FRAME_ASPECT, frameRegion } from "@/lib/images/framing";
import { fitBox, pan, placeImage, sameFraming, settle, zoomAt } from "@/lib/images/frame-view";

const img = { w: 2000, h: 1000 };
const A = FRAME_ASPECT.campaign;

describe("fitBox", () => {
  it("fits the frame's shape in the space", () => {
    expect(fitBox({ w: 1000, h: 500 }, 2)).toEqual({ w: 1000, h: 500 });
    expect(fitBox({ w: 1000, h: 1000 }, 0.5)).toEqual({ w: 500, h: 1000 });
  });
});

describe("placeImage", () => {
  it("draws the image so the box shows exactly the importer's region", () => {
    const boxW = 300;
    const p = placeImage(img, A, CENTRED, boxW);
    const r = frameRegion(img.w, img.h, A, CENTRED);
    const scale = boxW / r.width;
    expect(p.left).toBeCloseTo(-r.left * scale);
    expect(p.width).toBeCloseTo(img.w * scale);
    // The box's right edge is the region's right edge.
    expect(-p.left + boxW).toBeCloseTo((r.left + r.width) * scale);
  });
});

describe("pan", () => {
  it("moves the picture with the pointer, and stops at the image's edge", () => {
    const moved = pan(img, A, CENTRED, 100, 0, 300);
    // Dragged right: the frame shows more of the left.
    expect(moved.x).toBeLessThan(0.5);
    const far = pan(img, A, CENTRED, 100_000, 0, 300);
    expect(frameRegion(img.w, img.h, A, far).left).toBe(0);
    // Fill frame on a portrait-ish frame: no room to move vertically.
    expect(pan(img, A, CENTRED, 0, 50, 300).y).toBeCloseTo(0.5);
  });
});

describe("zoomAt", () => {
  it("keeps the point under the pointer in place", () => {
    const z = zoomAt(img, A, CENTRED, 2, 0.25, 0.25);
    const before = frameRegion(img.w, img.h, A, CENTRED);
    const after = frameRegion(img.w, img.h, A, z);
    expect(before.left + 0.25 * before.width).toBeCloseTo(after.left + 0.25 * after.width, 0);
    expect(before.top + 0.25 * before.height).toBeCloseTo(after.top + 0.25 * after.height, 0);
  });

  it("stays between 1 and the maximum", () => {
    expect(zoomAt(img, A, CENTRED, 0.3).zoom).toBe(1);
    expect(zoomAt(img, A, CENTRED, 99).zoom).toBe(5);
  });
});

describe("settle / sameFraming", () => {
  it("moves a centre that would leave the image to where the frame really sits", () => {
    const s = settle(img, A, { zoom: 1, x: 0, y: 0 });
    expect(frameRegion(img.w, img.h, A, s)).toEqual(frameRegion(img.w, img.h, A, { zoom: 1, x: 0, y: 0 }));
    expect(s.x).toBeGreaterThan(0);
  });

  it("treats no framing as the centre crop", () => {
    expect(sameFraming(null, CENTRED)).toBe(true);
    expect(sameFraming(null, { zoom: 1.2, x: 0.5, y: 0.5 })).toBe(false);
  });
});
