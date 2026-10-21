import "server-only";
import { prisma } from "@/lib/prisma";
import type { TeamScope } from "@/lib/auth/scope";
import type { ExportGroup } from "@/lib/export/groups";

/** Every batch with a finished brand, newest first, with its brands: the export screen picks from these. */
export async function listExportGroups(_scope: TeamScope): Promise<ExportGroup[]> {
  const batches = await prisma.batch.findMany({
    where: { brands: { some: { status: { in: ["needs_review", "approved", "exported"] } } } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, brands: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, status: true } } },
  });
  return batches.map((b) => ({ id: b.id, createdAt: b.createdAt.toISOString(), brands: b.brands }));
}
