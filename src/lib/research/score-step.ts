import "server-only";
import type { CandidateScore } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { REQUIRED_FIELDS, reviewSummary, type RequiredField } from "@/lib/research/review-summary";
import type { ResearchLog } from "@/lib/research/log-types";

/** Spec §6 step 7: count what still needs a person. The status moves to needs_review in `finishResearch`. */
export async function runScoreStep(brandId: string, log: ResearchLog): Promise<void> {
  const selections = await prisma.selection.findMany({
    where: { brandId, field: { in: [...REQUIRED_FIELDS] } },
    include: { candidate: { select: { score: true } } },
  });
  const fields = Object.fromEntries(
    REQUIRED_FIELDS.map((f) => [f, selections.find((s) => s.field === f)?.candidate?.score ?? null]),
  ) as Record<RequiredField, CandidateScore | null>;
  const summary = reviewSummary(fields);
  await prisma.brand.update({ where: { id: brandId }, data: { reviewCount: summary.count } });
  await log(summary.message, summary.level);
}
