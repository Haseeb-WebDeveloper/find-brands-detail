import { z } from "zod";

/** Ids only: the job re-reads everything it needs from the database. */
export const brandResearchRequested = {
  name: "brand/research.requested",
  schema: z.object({ brandId: z.string().uuid() }),
} as const;

export function brandResearchEvent(brandId: string) {
  return { name: brandResearchRequested.name, data: brandResearchRequested.schema.parse({ brandId }) };
}

/**
 * Only the AI-made parts a brand is missing (research/ai-fill.ts). `moreCampaigns`: only look for
 * more campaigns, however many it has ("Find more campaigns").
 */
export const brandAiFillRequested = {
  name: "brand/ai-fill.requested",
  schema: z.object({ brandId: z.string().uuid(), moreCampaigns: z.boolean().optional() }),
} as const;

export function brandAiFillEvent(brandId: string, moreCampaigns = false) {
  return { name: brandAiFillRequested.name, data: brandAiFillRequested.schema.parse(moreCampaigns ? { brandId, moreCampaigns } : { brandId }) };
}
