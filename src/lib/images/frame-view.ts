import { CENTRED, MAX_ZOOM, frameRegion, type Framing } from "@/lib/images/framing";

/**
 * Drawing a framing on screen, from the same `frameRegion` the importer cuts with: what the reviewer
 * sees in the frame is the region the DB will keep.
 */

type Size = { w: number; h: number };

/** The largest box of `aspect` that fits in the space. */
export function fitBox(space: Size, aspect: number): Size {
  return space.w / space.h > aspect ? { w: space.h * aspect, h: space.h } : { w: space.w, h: space.w / aspect };
}

/**
 * Where to draw the whole image so the frame (a box `boxW` wide at the frame's aspect, its top-left
 * at 0,0) shows exactly the framed region: pixels, relative to the box.
 */
export function placeImage(image: Size, aspect: number, framing: Framing, boxW: number): { left: number; top: number; width: number; height: number } {
  const r = frameRegion(image.w, image.h, aspect, framing);
  const scale = boxW / r.width;
  return { left: -r.left * scale, top: -r.top * scale, width: image.w * scale, height: image.h * scale };
}

/** The same framing, its centre moved to where the frame really sits (it never leaves the image). */
export function settle(image: Size, aspect: number, framing: Framing): Framing {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, framing.zoom));
  const r = frameRegion(image.w, image.h, aspect, { ...framing, zoom });
  return { zoom, x: (r.left + r.width / 2) / image.w, y: (r.top + r.height / 2) / image.h };
}

/** Dragging the picture by `dx`,`dy` screen pixels: it follows the pointer. */
export function pan(image: Size, aspect: number, framing: Framing, dx: number, dy: number, boxW: number): Framing {
  const r = frameRegion(image.w, image.h, aspect, framing);
  const perPixel = r.width / boxW;
  return settle(image, aspect, { ...framing, x: framing.x - (dx * perPixel) / image.w, y: framing.y - (dy * perPixel) / image.h });
}

/**
 * Zooming to `zoom`, keeping the point under (`px`,`py`), a fraction of the box from its top-left, in
 * place: the picture grows from where the pointer is, as on a phone. The box's centre by default.
 */
export function zoomAt(image: Size, aspect: number, framing: Framing, zoom: number, px = 0.5, py = 0.5): Framing {
  const before = frameRegion(image.w, image.h, aspect, framing);
  const z = Math.min(MAX_ZOOM, Math.max(1, zoom));
  const after = frameRegion(image.w, image.h, aspect, { ...framing, zoom: z });
  // The image point under the pointer, before and after: the same.
  const ix = before.left + px * before.width;
  const iy = before.top + py * before.height;
  const left = ix - px * after.width;
  const top = iy - py * after.height;
  return settle(image, aspect, { zoom: z, x: (left + after.width / 2) / image.w, y: (top + after.height / 2) / image.h });
}

export const sameFraming = (a: Framing | null, b: Framing | null) => {
  const x = a ?? CENTRED;
  const y = b ?? CENTRED;
  return Math.abs(x.zoom - y.zoom) < 0.005 && Math.abs(x.x - y.x) < 0.0005 && Math.abs(x.y - y.y) < 0.0005;
};
