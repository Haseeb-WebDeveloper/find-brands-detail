export const MAX_BATCH_NAME = 80;

/** The name a batch gets when none is typed: when it was started, in the reviewer's own time. */
export function defaultBatchName(at: Date): string {
  return `Batch of ${at.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;
}

/** A typed name, tidied: spaces collapsed, cut to the limit; empty is null. */
export function cleanBatchName(name: string | null | undefined): string | null {
  const clean = (name ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_BATCH_NAME).trim();
  return clean || null;
}

/** What a batch is called on screen; batches from before names fall back to their day. */
export function batchTitle(batch: { name: string | null; createdAt: string | Date }): string {
  return batch.name ?? `Batch of ${new Date(batch.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

/** The export's file name: the batch name made safe for a file, and the day. */
export function exportFileName(batchName: string, at: Date): string {
  const safe = batchName
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
  return `${safe || "brand-enrich"}-${at.toISOString().slice(0, 10)}.csv`;
}
