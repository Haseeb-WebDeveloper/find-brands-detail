import "server-only";
import type { BrandStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TeamScope } from "@/lib/auth/scope";
import type { ParsedBrand } from "@/lib/batches/parse-input";

export async function createBatchWithBrands(scope: TeamScope, brands: ParsedBrand[], name: string | null): Promise<{ batchId: string; brandIds: string[] }> {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.batch.create({ data: { createdById: scope.userId, name }, select: { id: true } });
    const created = await tx.brand.createManyAndReturn({
      data: brands.map((b) => ({ batchId: batch.id, name: b.name, websiteHint: b.websiteHint })),
      select: { id: true },
    });
    return { batchId: batch.id, brandIds: created.map((c) => c.id) };
  });
}

/**
 * Deletes a batch and everything under it (brands, candidates, choices, campaigns, text, pages and
 * logs go with it by cascade). AI usage rows keep their copy of the brand name, so usage history
 * stays. Checked again inside the transaction, so research that started a moment ago still blocks.
 */
export async function deleteBatchIfIdle(
  _scope: TeamScope,
  batchId: string,
  blocker: (brands: { id: string; status: BrandStatus; updatedAt: Date }[]) => string | null,
): Promise<{ ok: true; name: string | null } | { ok: false; error: string }> {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.batch.findUnique({ where: { id: batchId }, select: { name: true, brands: { select: { id: true, status: true, updatedAt: true } } } });
    if (!batch) return { ok: false as const, error: "This batch is already gone." };
    const reason = blocker(batch.brands);
    if (reason) return { ok: false as const, error: reason };
    await tx.batch.delete({ where: { id: batchId } });
    return { ok: true as const, name: batch.name };
  });
}
