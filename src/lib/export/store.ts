import "server-only";
import { prisma } from "@/lib/prisma";
import type { TeamScope } from "@/lib/auth/scope";

/** After a download: the brands are in the DB's hands now. They can be exported again. */
export async function markExported(_scope: TeamScope, brandIds: string[]): Promise<void> {
  await prisma.brand.updateMany({ where: { id: { in: brandIds }, status: { in: ["approved", "exported"] } }, data: { status: "exported" } });
}

export async function brandStatuses(_scope: TeamScope, brandIds: string[]): Promise<Map<string, string>> {
  const rows = await prisma.brand.findMany({ where: { id: { in: brandIds } }, select: { id: true, status: true } });
  return new Map(rows.map((r) => [r.id, r.status]));
}
