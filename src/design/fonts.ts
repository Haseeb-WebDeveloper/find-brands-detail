import { Inter } from "next/font/google";

/**
 * Inter with its OPTICAL SIZE axis, the one face of our design language (docs/DESIGN-LANGUAGE.md 6).
 *
 * Its own instance, not the template's `inter`: the template is the contractor's design and must be
 * free to change its type without moving ours. `opsz` is what makes it behave like San Francisco,
 * drawing small text open and sturdy and large text tight and fine, and `font-optical-sizing: auto`
 * in tokens.css turns it on. Apple's own face may only be used on Apple devices, so it is not an
 * option on the web.
 *
 * Applied as a CSS variable on the `[data-design]` root, so only our screens load it.
 */
export const designInter = Inter({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-design",
  display: "swap",
});
