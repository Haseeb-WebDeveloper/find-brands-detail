import "server-only";
import type { BrandStatus, CampaignStatus, CandidateScore, ImageSourceKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TeamScope } from "@/lib/auth/scope";
import type { PageFacts } from "@/lib/website/extract";
import type { LogLine } from "@/lib/batches/scoped";
import type { LogLevel } from "@/lib/research/log-types";
import { missingAiParts, stuckBrandIds, type MissingAi } from "@/lib/research/ai-fill";

export type CampaignCard = {
  id: string;
  position: number;
  title: string;
  description: string;
  date: string | null;
  /** Why the description needs a closer look, when it does. */
  note: string | null;
  sources: string[];
  status: CampaignStatus;
  images: { id: string; url: string; sourceKind: ImageSourceKind; width: number | null; height: number | null; score: CandidateScore; reason: string; selected: boolean }[];
};

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
  tiktok: FieldSection;
  logo: FieldSection;
  cover: FieldSection;
  pages: { url: string; source: string; archivedAt: string | null; facts: PageFacts }[];
  campaigns: CampaignCard[];
  /** The reviewer's brand text (spec §6 brand_text); empty strings until typed. */
  text: { description: string; tier: string; aesthetic: string; industry: string; regions: string };
  log: LogLine[];
  /** The batch's brands in order, for the pager and "Done → next". */
  siblings: { id: string; name: string; status: BrandStatus }[];
  /** Queued or researching, but its batch hasn't moved in a long while: the job died. */
  stuck: boolean;
  /** What the AI makes that this brand is still missing. */
  missingAi: MissingAi;
};

const FIELDS = ["website", "instagram", "tiktok", "logo", "cover"] as const;

/** The log lines a brand page carries; research writes a few dozen. */
const LOG_LINES = 150;

export async function getBrandDetail(_scope: TeamScope, id: string): Promise<BrandDetail | null> {
  // SEPARATE QUERIES, ALL AT ONCE. One `include` runs its relations one after another, and each round
  // trip to the database is ~200ms from here (measured 2026-10-21): seven in a row was over a second.
  const [base, candidates, selections, pages, logs, campaigns, siblings] = await Promise.all([
    prisma.brand.findUnique({ where: { id }, include: { text: true } }),
    prisma.candidate.findMany({ where: { brandId: id, field: { in: [...FIELDS] } }, orderBy: { createdAt: "asc" } }),
    prisma.selection.findMany({ where: { brandId: id, field: { in: [...FIELDS] } } }),
    prisma.brandPage.findMany({ where: { brandId: id }, orderBy: { fetchedAt: "asc" } }),
    prisma.researchLog.findMany({ where: { brandId: id }, orderBy: { createdAt: "desc" }, take: LOG_LINES }),
    prisma.campaign.findMany({ where: { brandId: id }, orderBy: { position: "asc" }, include: { images: { orderBy: [{ position: "asc" }, { id: "asc" }] } } }),
    prisma.brand.findMany({ where: { batch: { brands: { some: { id } } } }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, status: true, updatedAt: true } }),
  ]);
  if (!base) return null;
  const brand = { ...base, candidates, selections, pages, logs, campaigns };
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
    tiktok: section("tiktok"),
    logo: section("logo"),
    cover: section("cover"),
    pages: brand.pages.map((p) => ({ url: p.url, source: p.source, archivedAt: p.archivedAt, facts: p.facts as PageFacts })),
    campaigns: brand.campaigns.map((c) => {
      const src = (c.sourceUrls ?? {}) as { date?: string | null; note?: string | null; urls?: string[] };
      return {
        id: c.id,
        position: c.position,
        title: c.title,
        description: c.description,
        date: src.date ?? null,
        note: src.note ?? null,
        sources: src.urls ?? [],
        status: c.status,
        images: c.images.map((i) => ({ id: i.id, url: i.url, sourceKind: i.sourceKind, width: i.width, height: i.height, score: i.score, reason: i.reason, selected: i.selected })),
      };
    }),
    text: {
      description: brand.text?.description ?? "",
      tier: brand.text?.tier ?? "",
      aesthetic: brand.text?.aesthetic ?? "",
      industry: brand.text?.industry ?? "",
      regions: brand.text?.regions ?? "",
    },
    siblings: siblings.map(({ id, name, status }) => ({ id, name, status })),
    stuck: stuckBrandIds(siblings, Date.now()).has(brand.id),
    missingAi: missingAiParts(brand.campaigns.length, brand.text),
    log: brand.logs.map((l) => ({ id: l.id, brandId: l.brandId, brandName: brand.name, level: l.level as LogLevel, message: l.message, at: l.createdAt.toISOString() })),
  };
}
