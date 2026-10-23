import type { BrandStatus, CampaignStatus } from "@prisma/client";

/**
 * What the AI makes for a brand that's still missing:
 * - `campaigns`: fewer than the DB importer's minimum of 3 (removed ones don't count), so Fill looks
 *   for more and adds them after the ones there;
 * - `descriptions`: a campaign with an empty description, which Fill writes and nothing else;
 * - `details`: any empty brand detail, which Fill drafts, keeping the filled ones.
 */
export type MissingAi = { campaigns: boolean; descriptions: boolean; details: boolean };

/** The DB importer's minimum number of campaigns per brand. */
export const CAMPAIGNS_NEEDED = 3;

const DETAIL_FIELDS = ["description", "tier", "aesthetic", "industry", "regions"] as const;

export function missingAiParts(
  campaigns: { status: CampaignStatus; description: string }[],
  text: Partial<Record<(typeof DETAIL_FIELDS)[number], string | null>> | null,
): MissingAi {
  const live = campaigns.filter((c) => c.status !== "removed");
  return {
    campaigns: live.length < CAMPAIGNS_NEEDED,
    descriptions: live.some((c) => !c.description.trim()),
    details: DETAIL_FIELDS.some((f) => !text?.[f]?.trim()),
  };
}

/**
 * Whether "Fill in missing AI parts" applies: research has finished and the brand isn't reviewed yet
 * (a reviewed brand stays as the reviewer left it), and something is missing.
 */
export function canFillAi(status: BrandStatus, missing: MissingAi): boolean {
  return status === "needs_review" && (missing.campaigns || missing.descriptions || missing.details);
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

/** The Fill button's words, naming only what it will do: "Find more campaigns and write descriptions". */
export function fillLabel(missing: MissingAi): string {
  const parts = [missing.campaigns && "find more campaigns", missing.descriptions && "write campaign descriptions", missing.details && "draft the missing details"].filter(
    (p): p is string => Boolean(p),
  );
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : (parts[0] ?? "fill in missing AI parts");
  return text[0].toUpperCase() + text.slice(1);
}
