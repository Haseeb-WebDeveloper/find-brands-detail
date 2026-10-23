import "server-only";
import { prisma } from "@/lib/prisma";
import type { TeamScope } from "@/lib/auth/scope";
import { summarizeUsage, type UsageSummary } from "@/lib/usage/rules";

export const USAGE_DAYS = 14;

/** The last two weeks of AI calls (from the start of the UTC day), totalled for the Usage page. */
export async function readUsage(_scope: TeamScope): Promise<UsageSummary> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (USAGE_DAYS - 1));
  const rows = await prisma.aiCall.findMany({
    where: { createdAt: { gte: since } },
    select: { brandId: true, brandName: true, provider: true, outcome: true, totalTokens: true, requestsLeft: true, requestsLimit: true, error: true, createdAt: true },
  });
  return summarizeUsage(rows);
}
