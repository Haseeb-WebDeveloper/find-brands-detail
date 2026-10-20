"use client";

import { useRef, type ComponentProps } from "react";
import { cn } from "./cn";
import { useGlass, type GlassWeight } from "./use-glass";

/**
 * A surface of Liquid Glass, for the floating layer only: bars, groups of controls, panels.
 *
 * NEVER CONTENT. A table, a record, a quote sit on solid `surface`; glass is what floats over them
 * (docs/DESIGN-LANGUAGE.md 2). And never glass on glass: something opened from a glass bar floats
 * as its own surface, it is not nested inside.
 *
 * Its corner is whatever `rounded-*` you give it; the lens reads it back, so the bend always follows
 * the real shape.
 */
export function Glass({
  weight = "regular",
  kind,
  tone,
  lens = false,
  className,
  ...rest
}: {
  weight?: GlassWeight;
  kind?: "tinted" | "clear";
  /** Force dark or light glass where it sits over the opposite of the page: dark glass over a
   *  dark photo on a light page keeps its words readable, the way Apple's bars adapt. */
  tone?: "light" | "dark";
  /** The Chrome-only rim bend (use-glass.ts). Off by default; worth it over a photo or a map. */
  lens?: boolean;
} & ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);
  useGlass(ref, weight, lens);
  return (
    <div
      ref={ref}
      data-glass={weight}
      data-glass-kind={kind}
      data-glass-tone={tone}
      className={cn("rounded-panel", className)}
      {...rest}
    />
  );
}
