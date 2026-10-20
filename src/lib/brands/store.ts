import "server-only";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/realtime/broadcast";
import { BRAND_EVENTS, batchTopic, brandTopic, type BrandChangedPayload } from "@/lib/realtime/channels";
import type { ResearchStepId } from "@/lib/research/steps";
import type { TeamScope } from "@/lib/auth/scope";

/** A reviewer re-queues a brand: back to `queued`, error cleared. The job replaces old results. */
export async function resetForRetry(_scope: TeamScope, brandId: string): Promise<{ batchId: string } | null> {
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { batchId: true } });
  if (!brand) return null;
  await prisma.brand.update({ where: { id: brandId }, data: { status: "queued", currentStep: null, error: null } });
  await announce(brandId, brand.batchId, null);
  return brand;
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
