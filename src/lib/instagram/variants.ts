import { compactName } from "@/lib/website/domain";

const ALL_SUFFIXES = ["", "_official", "_global", ".global", ".official"];
/** Tried when the brand's sites link only regional accounts: the global account may exist unlinked. */
export const GLOBAL_SUFFIXES = ["_global", ".global"];

/**
 * Likely handles when the brand's sites link none. Instagram handles allow letters, digits, `.` and
 * `_`, so a name with punctuation keeps it in a second and third form ("Dr.G" → drg, dr.g, dr_g).
 * Ordered by suffix first, so a small lookup budget covers every form of the likeliest suffixes.
 */
export function nameVariants(brand: string, suffixes: string[] = ALL_SUFFIXES): string[] {
  const words = brand.split(/[^A-Za-z0-9À-ɏ]+/).map(compactName).filter(Boolean);
  const bases = [...new Set([compactName(brand), words.join("."), words.join("_")])].filter(Boolean).map((b) => b.slice(0, 22));
  return [...new Set(suffixes.flatMap((s) => bases.map((b) => `${b}${s}`)))];
}
