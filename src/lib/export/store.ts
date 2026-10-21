import "server-only";
import { prisma } from "@/lib/prisma";
import type { TeamScope } from "@/lib/auth/scope";

/** After a download. Brands still researching are left alone; any brand can be exported again. */
export async function markExported(_scope: TeamScope, brandIds: string[]): Promise<void> {
  await prisma.brand.updateMany({ where: { id: { in: brandIds }, status: { in: ["needs_review", "approved", "exported"] } }, data: { status: "exported" } });
}
