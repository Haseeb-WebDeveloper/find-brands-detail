/** What the export screen offers: every batch with its brands; any brand whose research has finished can go. */
export type ExportBrand = { id: string; name: string; status: string };
export type ExportGroup = { id: string; createdAt: string; brands: ExportBrand[] };

export const exportable = (b: ExportBrand) => b.status === "needs_review" || b.status === "approved" || b.status === "exported";

/** The brands a batch's checkbox picks. */
export function batchPick(group: ExportGroup): string[] {
  return group.brands.filter(exportable).map((b) => b.id);
}

/** Checked, unchecked or some, for a batch's checkbox given what is selected. */
export function batchState(group: ExportGroup, selected: ReadonlySet<string>): "all" | "none" | "some" {
  const ids = batchPick(group);
  const n = ids.filter((id) => selected.has(id)).length;
  return n === 0 ? "none" : n === ids.length ? "all" : "some";
}

/** What starts selected: the batch named in the link (Export batch), or else the newest batch. */
export function initialSelection(groups: ExportGroup[], batchId: string | null): string[] {
  const named = (batchId ? groups.find((g) => g.id === batchId) : undefined) ?? groups[0];
  return named ? batchPick(named) : [];
}
