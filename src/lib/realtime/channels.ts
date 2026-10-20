/** Shared by server and browser. Payloads carry ids only; the page re-reads through the server. */
export function batchTopic(batchId: string): string {
  return `batch:${batchId}`;
}

export function brandTopic(brandId: string): string {
  return `brand:${brandId}`;
}

export const BRAND_EVENTS = { CHANGED: "brand:changed" } as const;

export type BrandChangedPayload = { brandId: string; step: string | null };
