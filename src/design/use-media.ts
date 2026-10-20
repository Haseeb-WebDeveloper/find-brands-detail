"use client";

import { useSyncExternalStore } from "react";

/**
 * Does this media query match? For the few things whose SHAPE changes with the device and so cannot
 * live in CSS alone: the switch's travel, a sheet that rises from the bottom on a phone and slides
 * from the side on a desktop. Everything else adapts in CSS.
 *
 * The server cannot know, so it answers `serverValue` (the desktop answer), corrected on the
 * client's first paint.
 */
export function useMedia(query: string, serverValue = false) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** Is the main pointer a finger? */
export function useCoarsePointer() {
  return useMedia("(pointer: coarse)");
}

/** Below 768px: the phone layout (docs/DESIGN-LANGUAGE.md 8). */
export function usePhone() {
  return useMedia("(max-width: 767px)");
}
