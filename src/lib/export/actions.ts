"use server";

import { revalidatePath } from "next/cache";
import { getTeamScope, scopeCan } from "@/lib/auth/scope";
import { IMPORT_HEADERS } from "@/lib/export/importer/brand-import";
import { buildImportRow } from "@/lib/export/row";
import { toCsv } from "@/lib/export/csv";
import { imageCells, imageNote } from "@/lib/export/problems";
import { markExported } from "@/lib/export/store";
import { getReviewState } from "@/lib/review/scoped";
import { checkImageUrl } from "@/lib/images/check-image";

export type ExportResult = { ok: true; csv: string; filename: string; count: number; notes: string[] } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BRANDS = 100;

/**
 * The chosen brands, as they are, as the DB importer's CSV. Never blocks (owner, 2026-10-21): empty
 * fields stay empty, and an image that no longer loads is left empty and noted.
 */
export async function exportBrands(brandIds: string[]): Promise<ExportResult> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "batches:write")) return { ok: false, error: "You can't export brands." };
  const ids = [...new Set(brandIds)].filter((id) => UUID.test(id)).slice(0, MAX_BRANDS);
  if (ids.length === 0) return { ok: false, error: "Choose at least one brand." };

  const rows = [];
  const notes: string[] = [];
  for (const id of ids) {
    const state = await getReviewState(scope, id);
    if (!state) continue;
    const row = buildImportRow(state);
    // One at a time: politeness to each image host.
    for (const cell of imageCells(row)) {
      const note = imageNote(state.name, cell.column, await checkImageUrl(cell.url, cell.slot));
      if (note) {
        row[cell.column] = "";
        notes.push(note);
      }
    }
    rows.push(row);
  }

  await markExported(scope, ids);
  revalidatePath("/export");
  revalidatePath("/");
  return { ok: true, csv: toCsv(IMPORT_HEADERS, rows), filename: `brand-enrich-${new Date().toISOString().slice(0, 10)}.csv`, count: rows.length, notes };
}
