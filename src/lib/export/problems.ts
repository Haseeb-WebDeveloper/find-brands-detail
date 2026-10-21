import type { ImageCheckResult } from "@/lib/images/check-image";
import { imageColumnSlot, type RawImportRow } from "@/lib/export/importer/brand-import";

/** The image columns of a row, with the slot the importer checks each against. */
export function imageCells(row: RawImportRow): { column: string; url: string; slot: "logo" | "cover" | "campaign" }[] {
  return Object.entries(row).flatMap(([column, url]) => {
    const slot = imageColumnSlot(column);
    return slot && url ? [{ column, url, slot }] : [];
  });
}

const NAME = (column: string) =>
  column === "logo_url" ? "Logo" : column === "cover_image_url" ? "Cover" : `Campaign ${column.match(/^campaign_(\d+)_/)?.[1] ?? ""} image`;

/** Spec §12: images are re-checked at export; one that no longer passes blocks the brand. */
export function imageProblem(column: string, check: ImageCheckResult): string | null {
  if (check.ok && check.passesMin) return null;
  const why = check.reason ?? (check.ok ? "too small" : "doesn't load");
  return `${NAME(column)}: the image no longer passes the DB's check (${why}). Pick another on the brand page.`;
}
