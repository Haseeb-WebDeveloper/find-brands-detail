import "server-only";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/realtime/broadcast";
import { BRAND_EVENTS, batchTopic, brandTopic, type BrandChangedPayload } from "@/lib/realtime/channels";
import type { ResearchStepId } from "@/lib/research/steps";

/** Called only by the research job (Inngest), never from a user request, so it takes no scope. */
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
