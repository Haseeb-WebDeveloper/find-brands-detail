import "server-only";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/realtime/broadcast";
import { BRAND_EVENTS, batchTopic, brandTopic, type BrandChangedPayload } from "@/lib/realtime/channels";
import type { ResearchStepId } from "@/lib/research/steps";
import type { TeamScope } from "@/lib/auth/scope";
import { canFillAi, missingAiParts } from "@/lib/research/ai-fill";

/** A reviewer re-queues a brand: back to `queued`, error cleared. The job replaces old results. */
export async function resetForRetry(_scope: TeamScope, brandId: string): Promise<{ batchId: string } | null> {
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { batchId: true } });
  if (!brand) return null;
  await prisma.brand.update({ where: { id: brandId }, data: { status: "queued", currentStep: null, error: null } });
  await announce(brandId, brand.batchId, null);
  return brand;
}

/**
 * Queues "fill in missing AI parts" for the given brands (or every brand of a batch), keeping only
 * those it applies to (canFillAi, checked here again, not trusted from the page). Returns the brands
 * queued and their batches.
 */
export async function queueAiFill(_scope: TeamScope, where: { brandId: string } | { batchId: string }): Promise<{ ids: string[]; batchIds: string[] }> {
  const brands = await prisma.brand.findMany({
    where: "brandId" in where ? { id: where.brandId } : { batchId: where.batchId },
    select: { id: true, batchId: true, status: true, text: true, _count: { select: { campaigns: true } } },
  });
  const eligible = brands.filter((b) => canFillAi(b.status, missingAiParts(b._count.campaigns, b.text)));
  if (eligible.length === 0) return { ids: [], batchIds: [] };
  await prisma.brand.updateMany({ where: { id: { in: eligible.map((b) => b.id) } }, data: { status: "queued", currentStep: null, error: null } });
  for (const b of eligible) await announce(b.id, b.batchId, null);
  return { ids: eligible.map((b) => b.id), batchIds: [...new Set(eligible.map((b) => b.batchId))] };
}

/** The functions below are called only by the research job (Inngest), so they take no scope. */
async function announce(brandId: string, batchId: string, step: string | null) {
  const payload: BrandChangedPayload = { brandId, step };
  await broadcast([
    { topic: batchTopic(batchId), event: BRAND_EVENTS.CHANGED, payload },
    { topic: brandTopic(brandId), event: BRAND_EVENTS.CHANGED, payload },
  ]);
}

export async function markStep(brandId: string, stepId: ResearchStepId): Promise<void> {
  const brand = await prisma.brand.update({
    where: { id: brandId },
    data: { status: "researching", currentStep: stepId, error: null },
    select: { batchId: true },
  });
  await announce(brandId, brand.batchId, stepId);
}

export async function finishResearch(brandId: string): Promise<void> {
  const brand = await prisma.brand.update({
    where: { id: brandId },
    data: { status: "needs_review", currentStep: null },
    select: { batchId: true },
  });
  await announce(brandId, brand.batchId, null);
}

export async function failResearch(brandId: string, message: string): Promise<void> {
  const brand = await prisma.brand.update({
    where: { id: brandId },
    data: { status: "needs_review", error: message },
    select: { batchId: true },
  });
  await announce(brandId, brand.batchId, null);
}
