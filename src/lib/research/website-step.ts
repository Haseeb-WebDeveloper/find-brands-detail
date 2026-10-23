import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchPage } from "@/lib/website/fetch-page";
import { latestSnapshot } from "@/lib/website/archive";
import { findOfficialSites } from "@/lib/website/discover";
import { researchWebsite, type CheckedSite } from "@/lib/website/research";
import type { ResearchLog } from "@/lib/research/log-types";

const SOURCE_LABEL: Record<CheckedSite["source"], string> = {
  hint: "Website given in the batch",
  search: "Found by web search",
  "regional-link": "Linked from the brand's own site",
};

const json = (value: unknown) => value as Prisma.InputJsonValue;

/**
 * Runs inside the Inngest job, so it takes no scope (AGENTS.md rule 2 exception). Re-running it
 * replaces the brand's website candidates, pages and auto selection: research is idempotent.
 */
export async function runWebsiteStep(brandId: string, log: ResearchLog): Promise<void> {
  const brand = await prisma.brand.findUniqueOrThrow({ where: { id: brandId }, select: { name: true, websiteHint: true } });
  // The network work happens before the transaction, so no database connection waits on a website.
  const { candidates, chosen } = await researchWebsite(brand.name, brand.websiteHint, { fetchPage, latestSnapshot, findOfficialSites }, log);

  await prisma.$transaction(async (tx) => {
    await tx.selection.deleteMany({ where: { brandId, field: "website" } });
    await tx.candidate.deleteMany({ where: { brandId, field: "website" } });
    await tx.brandPage.deleteMany({ where: { brandId } });

    let chosenId: string | null = null;
    for (const c of candidates) {
      const row = await tx.candidate.create({
        data: {
          brandId,
          field: "website",
          value: c.verdict.siteUrl,
          source: SOURCE_LABEL[c.source],
          score: c.verdict.score,
          reason: c.verdict.reason,
          evidence: json({
            checkedUrl: c.url,
            kind: c.verdict.kind,
            title: c.facts?.title ?? null,
            archivedAt: c.archive?.timestamp ?? null,
          }),
        },
        select: { id: true },
      });
      if (c === chosen) chosenId = row.id;
      if (c.facts) {
        await tx.brandPage.create({
          data: { brandId, url: c.verdict.siteUrl, source: "live", verdictKind: c.verdict.kind, facts: json(c.facts) },
        });
      }
      if (c.archive) {
        await tx.brandPage.create({
          data: { brandId, url: c.url, source: "archive", archivedAt: c.archive.timestamp, verdictKind: c.verdict.kind, facts: json(c.archive.facts) },
        });
      }
    }
    if (chosenId) {
      await tx.selection.create({ data: { brandId, field: "website", candidateId: chosenId, chosenBy: "auto" } });
    }
  });
}
