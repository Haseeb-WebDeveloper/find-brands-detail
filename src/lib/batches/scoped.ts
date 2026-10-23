import "server-only";
import type { BrandStatus, CandidateScore } from "@prisma/client";
import { REVIEW_FIELDS, type ReviewField } from "@/lib/export/row";
import { prisma } from "@/lib/prisma";
import type { TeamScope } from "@/lib/auth/scope";
import type { LogLevel } from "@/lib/research/log-types";
import { missingAiParts, stuckBrandIds, type MissingAi } from "@/lib/research/ai-fill";

export type BatchListItem = {
  id: string;
  name: string | null;
  createdAt: string;
  createdBy: string | null;
  brandCount: number;
  /** Research finished (ready for review, approved or exported). */
  done: number;
  researching: number;
  needsReview: number;
  approved: number;
  exported: number;
  failed: number;
  /** The first few brand names, for the card. */
  names: string[];
};

export type BrandRow = {
  id: string;
  name: string;
  status: BrandStatus;
  currentStep: string | null;
  reviewCount: number;
  error: string | null;
  /** The brand's latest log line: what it is doing right now. */
  lastLog: string | null;
  /** The chosen value's score per field; null when nothing is chosen. */
  fields: Record<ReviewField, CandidateScore | null>;
  /** The chosen value per field, with the follower count for the social accounts. */
  chosen: Record<ReviewField, { value: string; score: CandidateScore; followers: number | null } | null>;
  campaigns: { approved: number; total: number };
  /** Queued or researching, but the batch hasn't moved in a long while: the job died. */
  stuck: boolean;
  /** What the AI makes that this brand is still missing. */
  missingAi: MissingAi;
};

export type LogLine = { id: string; brandId: string; brandName: string; level: LogLevel; message: string; at: string };

const FINISHED: BrandStatus[] = ["needs_review", "approved", "exported"];
/** Enough lines to follow a batch; older ones are on each brand's page. */
const BATCH_LOG_LINES = 200;

/** Uncached on purpose: live research data. */
export async function listBatches(_scope: TeamScope): Promise<BatchListItem[]> {
  const batches = await prisma.batch.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      createdBy: { select: { email: true } },
      brands: { orderBy: { createdAt: "asc" }, select: { name: true, status: true, error: true } },
    },
  });
  return batches.map((b) => ({
    id: b.id,
    name: b.name,
    createdAt: b.createdAt.toISOString(),
    createdBy: b.createdBy?.email ?? null,
    brandCount: b.brands.length,
    done: b.brands.filter((x) => FINISHED.includes(x.status)).length,
    researching: b.brands.filter((x) => x.status === "researching").length,
    needsReview: b.brands.filter((x) => x.status === "needs_review").length,
    approved: b.brands.filter((x) => x.status === "approved").length,
    exported: b.brands.filter((x) => x.status === "exported").length,
    failed: b.brands.filter((x) => x.error).length,
    names: b.brands.slice(0, 6).map((x) => x.name),
  }));
}

export async function getBatch(
  _scope: TeamScope,
  id: string,
): Promise<{ id: string; name: string | null; createdAt: string; brands: BrandRow[]; log: LogLine[] } | null> {
  // Separate queries, all at once: each round trip to the database is ~200ms (brands/scoped.ts).
  const [batch, brands, selections, campaigns, log] = await Promise.all([
    prisma.batch.findUnique({ where: { id }, select: { id: true, name: true, createdAt: true } }),
    prisma.brand.findMany({
      where: { batchId: id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, status: true, currentStep: true, reviewCount: true, error: true, updatedAt: true, text: true },
    }),
    prisma.selection.findMany({
      where: { brand: { batchId: id } },
      select: { brandId: true, field: true, typedValue: true, candidate: { select: { value: true, score: true, evidence: true } } },
    }),
    prisma.campaign.findMany({ where: { brand: { batchId: id } }, select: { brandId: true, status: true, description: true } }),
    prisma.researchLog.findMany({
      where: { batchId: id },
      orderBy: { createdAt: "desc" },
      take: BATCH_LOG_LINES,
      select: { id: true, brandId: true, level: true, message: true, createdAt: true },
    }),
  ]);
  if (!batch) return null;
  const names = new Map(brands.map((b) => [b.id, b.name]));
  const stuck = stuckBrandIds(brands, Date.now());
  return {
    id: batch.id,
    name: batch.name,
    createdAt: batch.createdAt.toISOString(),
    brands: brands.map(({ updatedAt: _updatedAt, text, ...b }) => {
      const mine = selections.filter((x) => x.brandId === b.id);
      const camps = campaigns.filter((c) => c.brandId === b.id);
      const chosen = (f: ReviewField) => {
        const sel = mine.find((x) => x.field === f);
        if (!sel?.candidate) return null;
        const followers = (sel.candidate.evidence as { followers?: number | null } | null)?.followers;
        return { value: sel.typedValue ?? sel.candidate.value, score: sel.candidate.score, followers: typeof followers === "number" ? followers : null };
      };
      return {
        ...b,
        lastLog: log.find((l) => l.brandId === b.id)?.message ?? null,
        fields: Object.fromEntries(REVIEW_FIELDS.map((f) => [f, chosen(f)?.score ?? null])) as BrandRow["fields"],
        chosen: Object.fromEntries(REVIEW_FIELDS.map((f) => [f, chosen(f)])) as BrandRow["chosen"],
        campaigns: { approved: camps.filter((c) => c.status === "approved").length, total: camps.filter((c) => c.status !== "removed").length },
        stuck: stuck.has(b.id),
        missingAi: missingAiParts(camps, text),
      };
    }),
    log: log.map((l) => ({
      id: l.id,
      brandId: l.brandId,
      brandName: names.get(l.brandId) ?? "",
      level: l.level as LogLevel,
      message: l.message,
      at: l.createdAt.toISOString(),
    })),
  };
}
