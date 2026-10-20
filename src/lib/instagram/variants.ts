import { compactName } from "@/lib/website/domain";

/** Likely handles when the brand's sites link none. Instagram handles allow letters, digits, `.` and `_`. */
export function nameVariants(brand: string): string[] {
  const base = compactName(brand).slice(0, 22);
  if (!base) return [];
  return [base, `${base}_official`, `${base}_global`, `${base}.global`, `${base}.official`];
}
