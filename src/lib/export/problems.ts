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
  column === "logo_url" ? "logo" : column === "cover_image_url" ? "cover" : `campaign ${column.match(/^campaign_(\d+)_/)?.[1] ?? ""} image`;

/**
 * Images are loaded again at export (Instagram links expire within days). One that no longer passes
 * is left empty rather than blocking the export; the note says which.
 */
export function imageNote(brand: string, column: string, check: ImageCheckResult): string | null {
  if (check.ok && check.passesMin) return null;
  return `${brand}: ${NAME(column)} ${check.ok ? "is too small" : "didn't load"}, left empty`;
}
