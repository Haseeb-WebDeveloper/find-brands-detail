import "server-only";
import type { BrandStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TeamScope } from "@/lib/auth/scope";

export type BatchListItem = { id: string; createdAt: string; createdBy: string | null; brandCount: number; needsReview: number };

export type BrandRow = {
  id: string;
  name: string;
  status: BrandStatus;
  currentStep: string | null;
  reviewCount: number;
  error: string | null;
};

/** Uncached on purpose: live research data. */
export async function listBatches(_scope: TeamScope): Promise<BatchListItem[]> {
  const batches = await prisma.batch.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, createdBy: { select: { email: true } }, brands: { select: { status: true } } },
  });
  return batches.map((b) => ({
    id: b.id,
    createdAt: b.createdAt.toISOString(),
    createdBy: b.createdBy?.email ?? null,
    brandCount: b.brands.length,
    needsReview: b.brands.filter((x) => x.status === "needs_review").length,
  }));
}

export async function getBatch(_scope: TeamScope, id: string): Promise<{ id: string; createdAt: string; brands: BrandRow[] } | null> {
  const batch = await prisma.batch.findUnique({
    where: { id },
    select: {
      id: true,
      createdAt: true,
      brands: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, status: true, currentStep: true, reviewCount: true, error: true },
      },
    },
  });
  if (!batch) return null;
  return { id: batch.id, createdAt: batch.createdAt.toISOString(), brands: batch.brands };
}
