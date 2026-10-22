/** Reading an image's real address out of a page, shared by the site crawler and the campaign reader. */

export function absolute(href: string | undefined | null, base: string): string | null {
  if (!href) return null;
  try {
    return new URL(href.trim(), base).toString();
  } catch {
    return null;
  }
}

/** The largest candidate of a srcset ("a.jpg 400w, b.jpg 1600w" → b.jpg). */
export function largest(srcset: string): string | undefined {
  return srcset
    .split(",")
    .map((part) => part.trim().split(/\s+/))
    .map(([u, w]) => ({ u, w: Number.parseFloat(w ?? "0") || 0 }))
    .sort((a, b) => b.w - a.w)[0]?.u;
}

/**
 * An <img>'s or <source>'s real address. Lazy-loading pages keep it in data-* attributes and put a
 * placeholder in src, so those come first; a srcset gives its largest size.
 */
export function realSource(attr: (name: string) => string | undefined): string | undefined {
  for (const name of ["data-srcset", "data-lazy-srcset", "srcset"]) {
    const set = attr(name);
    if (set) return largest(set);
  }
  return attr("data-src") ?? attr("data-lazy-src") ?? attr("data-original") ?? attr("data-lazy") ?? attr("src");
}

/** The address in an inline style's background-image ("background-image: url('/hero.jpg')"). */
export function backgroundImage(style: string | undefined): string | undefined {
  return style?.match(/background(?:-image)?\s*:[^;]*url\(\s*['"]?([^'")]+)['"]?\s*\)/i)?.[1];
}
