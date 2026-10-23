// Identical copy of db-admin src/lib/images/framing.ts (2026-10-23): the frame set here is the region cut there.
/**
 * Where an image sits in its frame, chosen before import (Brand Enrich's framing editor) instead of
 * the importer's centre crop.
 *
 * `zoom` 1 is "Fill Frame": the largest region of the image at the frame's aspect, which covers the
 * frame edge to edge; 2 shows half as much, magnified. `x`/`y` are the point of the image (0–1 across
 * and down) the frame is centred on; the frame never leaves the image, so a point near an edge just
 * pushes it to that edge.
 *
 * In the CSV a framing is one cell: "zoom,x,y" ("1.4,0.5,0.32"). An empty cell is the centre crop.
 * Brand Enrich keeps an identical copy of this file (src/lib/images/framing.ts there), so the frame
 * set there is the region cut here.
 */

export type Framing = { zoom: number; x: number; y: number };

export const CENTRED: Framing = { zoom: 1, x: 0.5, y: 0.5 };
export const MAX_ZOOM = 5;

/** A region of the image, in its own pixels. */
export type Region = { left: number; top: number; width: number; height: number };

/** The region of a `width`×`height` image a frame of aspect `aspect` (width/height) shows. */
export function frameRegion(width: number, height: number, aspect: number, framing: Framing = CENTRED): Region {
  // Largest region of the source at the frame's aspect: what Fill Frame keeps.
  const fillW = width / height > aspect ? height * aspect : width;
  const fillH = width / height > aspect ? height : width / aspect;
  const zoom = Math.min(MAX_ZOOM, Math.max(1, framing.zoom));
  const w = Math.max(1, Math.round(fillW / zoom));
  const h = Math.max(1, Math.round(fillH / zoom));
  const clamp = (v: number, max: number) => Math.min(Math.max(0, v), max);
  return {
    left: Math.round(clamp(framing.x * width - w / 2, width - w)),
    top: Math.round(clamp(framing.y * height - h / 2, height - h)),
    width: Math.min(w, width),
    height: Math.min(h, height),
  };
}

/** A CSV cell: null when empty (the centre crop), "invalid" when it isn't a framing. */
export function parseFraming(cell: string): Framing | null | "invalid" {
  const text = cell.trim();
  if (!text) return null;
  const parts = text.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return "invalid";
  const [zoom, x, y] = parts;
  if (zoom < 1 || zoom > MAX_ZOOM || x < 0 || x > 1 || y < 0 || y > 1) return "invalid";
  return { zoom, x, y };
}

export function formatFraming(f: Framing): string {
  return `${round(f.zoom, 2)},${round(f.x, 3)},${round(f.y, 3)}`;
}

const round = (n: number, places: number) => Number(n.toFixed(places)).toString();

/** "Must be zoom,x,y": said beside a cell that isn't one. */
export const FRAMING_HINT = `zoom,x,y — zoom 1 to ${MAX_ZOOM}, x and y 0 to 1 (e.g. 1.4,0.5,0.32); empty for the centre crop`;

/** The frames an image is placed in on the site (db-admin `FILL_FRAME_ASPECT`); logos aren't cropped. */
export const FRAME_ASPECT = { campaign: 200 / 236, cover: 16 / 11 } as const;
