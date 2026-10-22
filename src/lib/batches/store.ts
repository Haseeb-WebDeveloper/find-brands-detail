import "server-only";
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
