import "server-only";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/realtime/broadcast";
import { BRAND_EVENTS, batchTopic, brandTopic, type BrandChangedPayload } from "@/lib/realtime/channels";
import type { LogLevel, ResearchLog } from "@/lib/research/log-types";

/**
 * A logger for one brand's research: each line is saved, then announced on the batch and brand
 * channels so open pages re-read it within a second. Called only by the job, so it takes no scope.
 * Logging never fails the research: a line that can't be saved is dropped with a console error.
 */
export async function researchLogger(brandId: string, step: string | null): Promise<ResearchLog> {
  const { batchId } = await prisma.brand.findUniqueOrThrow({ where: { id: brandId }, select: { batchId: true } });
  const payload: BrandChangedPayload = { brandId, step };
  return async (message: string, level: LogLevel = "info") => {
    try {
      await prisma.researchLog.create({ data: { brandId, batchId, step, level, message } });
      void broadcast([
        { topic: batchTopic(batchId), event: BRAND_EVENTS.CHANGED, payload },
        { topic: brandTopic(brandId), event: BRAND_EVENTS.CHANGED, payload },
      ]);
    } catch (error) {
      console.error("[research-log] could not save a line", error);
    }
  };
}

/** A fresh run starts a fresh log. */
export async function clearResearchLog(brandId: string): Promise<void> {
  await prisma.researchLog.deleteMany({ where: { brandId } });
}
