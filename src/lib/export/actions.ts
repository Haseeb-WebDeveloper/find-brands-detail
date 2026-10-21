"use server";

import { revalidatePath } from "next/cache";
import { getTeamScope, scopeCan } from "@/lib/auth/scope";
import { IMPORT_HEADERS } from "@/lib/export/importer/brand-import";
import { buildImportRow } from "@/lib/export/row";
import { toCsv } from "@/lib/export/csv";
import { imageCells, imageProblem } from "@/lib/export/problems";
import { brandStatuses, markExported } from "@/lib/export/store";
import { getReviewState } from "@/lib/review/scoped";
import { approvalBlockers } from "@/lib/review/blockers";
import { checkImageUrl } from "@/lib/images/check-image";

export type ExportResult =
  | { ok: true; csv: string; filename: string; count: number }
  | { ok: false; error: string; report: { id: string; name: string; problems: string[] }[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BRANDS = 100;

/**
 * Spec §8 screen 6: checks the chosen brands against the DB importer's rules, re-checks every image
 * live (Instagram links expire within days), and returns the CSV — or what blocked it. Nothing is
 * marked exported unless every brand passes.
 */
export async function exportBrands(brandIds: string[]): Promise<ExportResult> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "batches:write")) return { ok: false, error: "You can't export brands.", report: [] };
  const ids = [...new Set(brandIds)].filter((id) => UUID.test(id)).slice(0, MAX_BRANDS);
  if (ids.length === 0) return { ok: false, error: "Choose at least one brand.", report: [] };

  const statuses = await brandStatuses(scope, ids);
  const rows = [];
  const report: { id: string; name: string; problems: string[] }[] = [];
  for (const id of ids) {
    const state = await getReviewState(scope, id);
    if (!state) continue;
    const problems = [...approvalBlockers(state).errors];
    if (!["approved", "exported"].includes(statuses.get(id) ?? "")) problems.unshift("Not approved yet.");
    const row = buildImportRow(state);
    // One at a time: politeness to each image host.
    for (const cell of imageCells(row)) {
      const problem = imageProblem(cell.column, await checkImageUrl(cell.url, cell.slot));
      if (problem) problems.push(problem);
    }
    if (problems.length > 0) report.push({ id, name: state.name, problems });
    rows.push(row);
  }
  if (report.length > 0) {
    return { ok: false, error: `${report.length} of ${ids.length} brand${ids.length === 1 ? "" : "s"} can't be exported yet.`, report };
  }

  await markExported(scope, ids);
  revalidatePath("/export");
  return { ok: true, csv: toCsv(IMPORT_HEADERS, rows), filename: `brand-enrich-${new Date().toISOString().slice(0, 10)}.csv`, count: rows.length };
}
