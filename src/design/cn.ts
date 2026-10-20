import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Our class joiner, told about our type scale.
 *
 * tailwind-merge has never heard of `text-callout`, so without this it files it as a COLOUR and a
 * later `text-label` silently deletes it. The template's `cn` has the same guard for its own scale;
 * ours is separate because the two systems share nothing. A new `--text-*` in tokens.css goes here
 * too, and `cn.test.ts` fails until it does.
 */
export const TYPE_STYLES = [
  "large-title",
  "title-1",
  "title-2",
  "title-3",
  "headline",
  "body",
  "callout",
  "subhead",
  "footnote",
  "caption",
] as const;

const merge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: [...TYPE_STYLES] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
