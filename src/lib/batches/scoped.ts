import "server-only";
import type { BrandStatus, CandidateScore } from "@prisma/client";
import { REVIEW_FIELDS, type ReviewField } from "@/lib/export/row";
import { prisma } from "@/lib/prisma";
import type { TeamScope } from "@/lib/auth/scope";
import type { LogLevel } from "@/lib/research/log-types";

export type BatchListItem = {
  id: string;
  createdAt: string;
  createdBy: string | null;
  brandCount: number;
  /** Research finished (ready for review, approved or exported). */
  done: number;
  researching: number;
  needsReview: number;
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
  campaigns: { approved: number; total: number };
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
      createdAt: true,
      createdBy: { select: { email: true } },
      brands: { orderBy: { createdAt: "asc" }, select: { name: true, status: true, error: true } },
    },
  });
  return batches.map((b) => ({
    id: b.id,
    createdAt: b.createdAt.toISOString(),
    createdBy: b.createdBy?.email ?? null,
    brandCount: b.brands.length,
    done: b.brands.filter((x) => FINISHED.includes(x.status)).length,
    researching: b.brands.filter((x) => x.status === "researching").length,
    needsReview: b.brands.filter((x) => x.status === "needs_review").length,
    failed: b.brands.filter((x) => x.error).length,
    names: b.brands.slice(0, 6).map((x) => x.name),
  }));
}

export async function getBatch(
  _scope: TeamScope,
  id: string,
): Promise<{ id: string; createdAt: string; brands: BrandRow[]; log: LogLine[] } | null> {
  const batch = await prisma.batch.findUnique({
    where: { id },
    select: {
      id: true,
      createdAt: true,
      brands: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          status: true,
          currentStep: true,
          reviewCount: true,
          error: true,
          logs: { orderBy: { createdAt: "desc" }, take: 1, select: { message: true } },
          selections: { select: { field: true, candidate: { select: { score: true } } } },
          campaigns: { select: { status: true } },
        },
      },
    },
  });
  if (!batch) return null;
  const names = new Map(batch.brands.map((b) => [b.id, b.name]));
  const log = await prisma.researchLog.findMany({
    where: { batchId: id },
    orderBy: { createdAt: "desc" },
    take: BATCH_LOG_LINES,
    select: { id: true, brandId: true, level: true, message: true, createdAt: true },
  });
  return {
    id: batch.id,
    createdAt: batch.createdAt.toISOString(),
    brands: batch.brands.map(({ logs, selections, campaigns, ...b }) => ({
      ...b,
      lastLog: logs[0]?.message ?? null,
      fields: Object.fromEntries(REVIEW_FIELDS.map((f) => [f, selections.find((x) => x.field === f)?.candidate?.score ?? null])) as Record<ReviewField, CandidateScore | null>,
      campaigns: { approved: campaigns.filter((c) => c.status === "approved").length, total: campaigns.filter((c) => c.status !== "removed").length },
    })),
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
