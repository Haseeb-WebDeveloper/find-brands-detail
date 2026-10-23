import type { BrandStatus } from "@prisma/client";
import { stuckBrandIds } from "@/lib/research/ai-fill";

/**
 * Why a batch can't be deleted yet, or null when it can. A brand still being researched would have
 * its job write to rows that are gone, so deleting waits for research to finish; brands whose research
 * died (stuck) don't hold it up, or a batch with a dead job could never be removed.
 */
export function deleteBlocker(brands: { id: string; status: BrandStatus; updatedAt: Date }[], now: number): string | null {
  const stuck = stuckBrandIds(brands, now);
  const running = brands.filter((b) => (b.status === "queued" || b.status === "researching") && !stuck.has(b.id)).length;
  if (running === 0) return null;
  return `${running === 1 ? "1 brand is" : `${running} brands are`} still being researched. Wait for research to finish, then delete.`;
}
