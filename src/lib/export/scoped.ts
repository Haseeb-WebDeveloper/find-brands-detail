import "server-only";
import { prisma } from "@/lib/prisma";
import type { TeamScope } from "@/lib/auth/scope";

export type ExportableBrand = { id: string; name: string; batchId: string; status: "approved" | "exported"; updatedAt: string };

/** Approved brands, and exported ones (they can be exported again). */
export async function listExportable(_scope: TeamScope): Promise<ExportableBrand[]> {
  const brands = await prisma.brand.findMany({
    where: { status: { in: ["approved", "exported"] } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: { id: true, name: true, batchId: true, status: true, updatedAt: true },
  });
  return brands.map((b) => ({ ...b, status: b.status as ExportableBrand["status"], updatedAt: b.updatedAt.toISOString() }));
}
