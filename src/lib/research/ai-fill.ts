import type { BrandStatus } from "@prisma/client";

/** What the AI makes for a brand that's still missing: campaigns (none at all), or any brand detail. */
export type MissingAi = { campaigns: boolean; details: boolean };

const DETAIL_FIELDS = ["description", "tier", "aesthetic", "industry", "regions"] as const;

export function missingAiParts(campaignCount: number, text: Partial<Record<(typeof DETAIL_FIELDS)[number], string | null>> | null): MissingAi {
  return {
    campaigns: campaignCount === 0,
    details: DETAIL_FIELDS.some((f) => !text?.[f]?.trim()),
  };
}

/**
 * Whether "Fill in missing AI parts" applies: research has finished and the brand isn't reviewed yet
 * (a reviewed brand stays as the reviewer left it), and something is missing.
 */
export function canFillAi(status: BrandStatus, missing: MissingAi): boolean {
  return status === "needs_review" && (missing.campaigns || missing.details);
}

/** How long a batch can show no research activity before its unfinished brands count as stuck. */
export const STUCK_AFTER_MS = 30 * 60 * 1000;

const running = (status: BrandStatus) => status === "queued" || status === "researching";

/**
 * The batch's brands whose research died: queued or researching, while nothing in the batch has moved
 * for STUCK_AFTER_MS. Judged per batch, not per brand: in a big batch, brands wait in the queue for a
 * long time (5 research at once) while the others make progress.
 */
export function stuckBrandIds(brands: { id: string; status: BrandStatus; updatedAt: Date }[], now: number): Set<string> {
  const unfinished = brands.filter((b) => running(b.status));
  if (unfinished.length === 0) return new Set();
  const lastMove = Math.max(...unfinished.map((b) => b.updatedAt.getTime()));
  return now - lastMove > STUCK_AFTER_MS ? new Set(unfinished.map((b) => b.id)) : new Set();
}
