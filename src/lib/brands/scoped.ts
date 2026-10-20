import "server-only";
import type { BrandStatus, CandidateScore } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TeamScope } from "@/lib/auth/scope";
import type { PageFacts } from "@/lib/website/extract";

export type BrandDetail = {
  id: string;
  name: string;
  batchId: string;
  status: BrandStatus;
  currentStep: string | null;
  reviewCount: number;
  error: string | null;
  website: {
    selectedCandidateId: string | null;
    candidates: { id: string; value: string; source: string; score: CandidateScore; reason: string; evidence: Record<string, unknown> }[];
  };
  pages: { url: string; source: string; archivedAt: string | null; facts: PageFacts }[];
};

export async function getBrandDetail(_scope: TeamScope, id: string): Promise<BrandDetail | null> {
  const brand = await prisma.brand.findUnique({
    where: { id },
    include: {
      candidates: { where: { field: "website" }, orderBy: { createdAt: "asc" } },
      selections: { where: { field: "website" } },
      pages: { orderBy: { fetchedAt: "asc" } },
    },
  });
  if (!brand) return null;
  return {
    id: brand.id,
    name: brand.name,
    batchId: brand.batchId,
    status: brand.status,
    currentStep: brand.currentStep,
    reviewCount: brand.reviewCount,
    error: brand.error,
    website: {
      selectedCandidateId: brand.selections[0]?.candidateId ?? null,
      candidates: brand.candidates.map((c) => ({
        id: c.id,
        value: c.value,
        source: c.source,
        score: c.score,
        reason: c.reason,
        evidence: (c.evidence ?? {}) as Record<string, unknown>,
      })),
    },
    pages: brand.pages.map((p) => ({ url: p.url, source: p.source, archivedAt: p.archivedAt, facts: p.facts as PageFacts })),
  };
}
