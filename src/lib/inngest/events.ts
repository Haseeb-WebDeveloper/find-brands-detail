import { z } from "zod";

/** Ids only: the job re-reads everything it needs from the database. */
export const brandResearchRequested = {
  name: "brand/research.requested",
  schema: z.object({ brandId: z.string().uuid() }),
} as const;

export function brandResearchEvent(brandId: string) {
  return { name: brandResearchRequested.name, data: brandResearchRequested.schema.parse({ brandId }) };
}
