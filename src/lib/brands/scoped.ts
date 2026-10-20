import "server-only";
import type { BrandStatus, CandidateScore } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TeamScope } from "@/lib/auth/scope";
import type { PageFacts } from "@/lib/website/extract";

type FieldSection = {
  selectedCandidateId: string | null;
  candidates: { id: string; value: string; source: string; score: CandidateScore; reason: string; evidence: Record<string, unknown> }[];
};

export type BrandDetail = {
  id: string;
  name: string;
  batchId: string;
  status: BrandStatus;
  currentStep: string | null;
  reviewCount: number;
  error: string | null;
  website: FieldSection;
  instagram: FieldSection;
  pages: { url: string; source: string; archivedAt: string | null; facts: PageFacts }[];
};

const FIELDS = ["website", "instagram"] as const;

export async function getBrandDetail(_scope: TeamScope, id: string): Promise<BrandDetail | null> {
  const brand = await prisma.brand.findUnique({
    where: { id },
    include: {
      candidates: { where: { field: { in: [...FIELDS] } }, orderBy: { createdAt: "asc" } },
      selections: { where: { field: { in: [...FIELDS] } } },
      pages: { orderBy: { fetchedAt: "asc" } },
    },
  });
  if (!brand) return null;
  const section = (field: (typeof FIELDS)[number]): FieldSection => ({
    selectedCandidateId: brand.selections.find((s) => s.field === field)?.candidateId ?? null,
    candidates: brand.candidates
      .filter((c) => c.field === field)
      .map((c) => ({
        id: c.id,
        value: c.value,
        source: c.source,
        score: c.score,
        reason: c.reason,
        evidence: (c.evidence ?? {}) as Record<string, unknown>,
      })),
  });
  return {
    id: brand.id,
    name: brand.name,
    batchId: brand.batchId,
    status: brand.status,
    currentStep: brand.currentStep,
    reviewCount: brand.reviewCount,
    error: brand.error,
    website: section("website"),
    instagram: section("instagram"),
    pages: brand.pages.map((p) => ({ url: p.url, source: p.source, archivedAt: p.archivedAt, facts: p.facts as PageFacts })),
  };
}
