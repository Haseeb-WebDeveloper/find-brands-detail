"use client";

import { useEffect, type RefObject } from "react";
import { lensFilter, lensSupported } from "./lens";

export type GlassWeight = "thin" | "regular" | "thick";

/** How the lens is cut for each weight. Big panels never get one (docs/DESIGN-LANGUAGE.md 5). */
const LENS: Record<GlassWeight, { bezel: number; strength: number } | null> = {
  // Subtle on purpose. A strong bend reads as a smeared photo, not as glass; the rim glow in
  // tokens.css carries most of the "thick edge", the lens only adds the faint curve behind it.
  thin: { bezel: 10, strength: 6 },
  regular: { bezel: 14, strength: 8 },
  thick: null,
};

/**
 * The lens for a `data-glass` element, in Chromium, when asked for.
 *
 * OFF BY DEFAULT (2026-10-13). The glass the owner pointed at as right (sell2skale's header) has no
 * lens at all; it gets its depth from the rim glow and the specular edge, which every browser draws.
 * The lens stays available for a surface that sits over a picture, where a bend is visible and
 * earns its cost.
 *
 * An effect over a ref rather than props, so it works on any element, motion ones included. Nothing
 * here touches React state.
 */
export function useGlass(ref: RefObject<HTMLElement | null>, weight: GlassWeight, lens = false) {
  useEffect(() => {
    const node = ref.current;
    const cut = LENS[weight];
    if (!node || !lens || !cut || !lensSupported()) return;

    const apply = () => {
      // offsetWidth, not the bounding box: a pressed button is scaled, and the map belongs to its
      // layout size. The filter scales with the element.
      const url = lensFilter({
        width: node.offsetWidth,
        height: node.offsetHeight,
        radius: parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0,
        ...cut,
      });
      if (url) {
        node.style.setProperty("--g-lens", url);
        node.setAttribute("data-lens", "");
      } else {
        node.style.removeProperty("--g-lens");
        node.removeAttribute("data-lens");
      }
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    return () => {
      observer.disconnect();
      node.removeAttribute("data-lens");
    };
  }, [ref, weight, lens]);
}
