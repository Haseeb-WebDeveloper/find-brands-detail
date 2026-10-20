/**
 * THE LENS: what makes our glass bend the page behind it rather than only blur it.
 *
 * Real glass is thicker at its rim, so light passing near the edge is bent and the content behind
 * appears to curve with the shape. We reproduce that with an SVG displacement filter applied to the
 * BACKDROP (`backdrop-filter: url(#lens)`): a map, drawn once per shape, tells every pixel near the
 * edge where to sample from. Inside the bezel nothing moves, so the middle stays perfectly clear.
 *
 * CHROMIUM ONLY, and that is the browsers, not us: Safari and Firefox do not run SVG filters in
 * `backdrop-filter`. They get every other part of the material (tokens.css), which is designed to
 * stand on its own. `lensSupported()` is the one place that decides.
 *
 * SHARED, NOT PER ELEMENT. A map depends only on width, height, corner and bezel, so forty
 * identical buttons share one filter. Filters live in one hidden <svg> at the end of <body>.
 *
 * A touch of dispersion: red, green and blue are bent by slightly different amounts, which is what
 * a real lens does at its edge and what stops it reading as a flat warp.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

let host: SVGSVGElement | null = null;
const filters = new Map<string, string>();
let counter = 0;

let supported: boolean | null = null;

/** Chromium, and the person has not asked for less transparency. */
export function lensSupported(): boolean {
  if (supported !== null) return supported;
  if (typeof window === "undefined") return false;
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } })
    .userAgentData?.brands;
  // Brands where the browser reports them; `window.chrome` for the Chromium builds that do not
  // (some headless and embedded ones). Safari and Firefox have neither.
  const chromium =
    !!brands?.some((b) => b.brand === "Chromium") || "chrome" in window;
  const reduced = window.matchMedia("(prefers-reduced-transparency: reduce)").matches;
  supported = chromium && !reduced;
  return supported;
}

export type LensShape = {
  width: number;
  height: number;
  radius: number;
  /** How far in from the edge the bend reaches, in px. */
  bezel: number;
  /** The strongest bend, in px. */
  strength: number;
};

/** Signed distance from a point to a rounded rectangle centred on the origin (negative inside). */
function roundedRectDistance(px: number, py: number, hw: number, hh: number, r: number) {
  const qx = Math.abs(px) - (hw - r);
  const qy = Math.abs(py) - (hh - r);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - r;
}

/**
 * The displacement map, as a PNG data URL. Red carries the horizontal shift and green the vertical,
 * with 128 meaning "stay". The bend follows a circular profile: nothing at the inner edge of the
 * bezel, steepening to the most at the rim, the way a rounded glass edge refracts.
 */
function drawMap({ width, height, radius, bezel }: LensShape): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(width, height);
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(radius, hw, hh);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x + 0.5 - hw;
      const py = y + 0.5 - hh;
      const d = -roundedRectDistance(px, py, hw, hh, r);
      let dx = 0;
      let dy = 0;
      if (d >= 0 && d < bezel) {
        const t = 1 - d / bezel;
        const magnitude = 1 - Math.sqrt(1 - t * t);
        // The edge's outward direction, from the slope of the distance field.
        const nx =
          roundedRectDistance(px + 1, py, hw, hh, r) - roundedRectDistance(px - 1, py, hw, hh, r);
        const ny =
          roundedRectDistance(px, py + 1, hw, hh, r) - roundedRectDistance(px, py - 1, hw, hh, r);
        const len = Math.hypot(nx, ny) || 1;
        // Sample from INSIDE: the rim shows content pulled outward, so it appears to curve over.
        dx = (-nx / len) * magnitude;
        dy = (-ny / len) * magnitude;
      }
      const i = (y * width + x) * 4;
      image.data[i] = 128 + dx * 127;
      image.data[i + 1] = 128 + dy * 127;
      image.data[i + 2] = 128;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

function ensureHost(): SVGSVGElement {
  if (host && host.isConnected) return host;
  host = document.createElementNS(SVG_NS, "svg");
  host.setAttribute("aria-hidden", "true");
  host.setAttribute("width", "0");
  host.setAttribute("height", "0");
  host.style.position = "absolute";
  host.style.pointerEvents = "none";
  host.appendChild(document.createElementNS(SVG_NS, "defs"));
  document.body.appendChild(host);
  return host;
}

function el(name: string, attrs: Record<string, string | number>) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** The `url(#…)` for this shape, building the filter the first time it is asked for. */
export function lensFilter(shape: LensShape): string | null {
  const width = Math.round(shape.width);
  const height = Math.round(shape.height);
  if (width < 8 || height < 8) return null;
  const key = `${width}x${height}r${Math.round(shape.radius)}b${shape.bezel}s${shape.strength}`;
  const existing = filters.get(key);
  if (existing) return `url(#${existing})`;

  const id = `ds-lens-${++counter}`;
  const filter = el("filter", {
    id,
    x: 0,
    y: 0,
    width,
    height,
    filterUnits: "userSpaceOnUse",
    "color-interpolation-filters": "sRGB",
  });
  filter.appendChild(
    el("feImage", {
      href: drawMap({ ...shape, width, height }),
      x: 0,
      y: 0,
      width,
      height,
      preserveAspectRatio: "none",
      result: "map",
    }),
  );
  // Three bends, one per colour, then put back together: the dispersion at the rim.
  const channels: [string, number, string][] = [
    ["r", 1, "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"],
    ["g", 1.04, "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"],
    ["b", 1.08, "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"],
  ];
  for (const [name, factor, matrix] of channels) {
    filter.appendChild(
      el("feDisplacementMap", {
        in: "SourceGraphic",
        in2: "map",
        scale: shape.strength * 2 * factor,
        xChannelSelector: "R",
        yChannelSelector: "G",
        result: `d${name}`,
      }),
    );
    filter.appendChild(
      el("feColorMatrix", { in: `d${name}`, type: "matrix", values: matrix, result: name }),
    );
  }
  filter.appendChild(el("feBlend", { in: "r", in2: "g", mode: "screen", result: "rg" }));
  filter.appendChild(el("feBlend", { in: "rg", in2: "b", mode: "screen" }));

  ensureHost().firstChild!.appendChild(filter);
  filters.set(key, id);
  return `url(#${id})`;
}
