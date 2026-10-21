import "server-only";
import { prisma } from "@/lib/prisma";
import { askPlain, askWithSearch } from "@/lib/ai/models";
import { checkImageUrl } from "@/lib/images/check-image";
import { fetchPage } from "@/lib/website/fetch-page";
import { researchCampaigns } from "@/lib/campaigns/research";
import { loadResearchPages } from "@/lib/research/pages";
import type { ResearchLog } from "@/lib/research/log-types";

type IgEvidence = { recentMedia?: { mediaType: string; mediaUrl: string | null; caption: string | null }[] };

/**
 * Runs inside the Inngest job, so it takes no scope (AGENTS.md rule 2 exception). Re-running
 * replaces the brand's proposed campaigns.
 */
export async function runCampaignsStep(brandId: string, log: ResearchLog): Promise<void> {
  const [{ name, brandDomains }, selections] = await Promise.all([
    loadResearchPages(brandId),
    prisma.selection.findMany({ where: { brandId, field: { in: ["website", "instagram"] } }, include: { candidate: true } }),
  ]);
  const site = selections.find((s) => s.field === "website")?.candidate?.value ?? null;
  const ig = selections.find((s) => s.field === "instagram")?.candidate;
  const input = {
    brand: name,
    site: site ? new URL(site).hostname.replace(/^www\./, "") : null,
    brandDomains,
    instagram: ig ? { handle: ig.value, posts: ((ig.evidence ?? {}) as IgEvidence).recentMedia ?? [] } : null,
  };

  // The network and model work happens before the transaction, so no database connection waits on it.
  const campaigns = await researchCampaigns(
    input,
    {
      search: (prompt, l) => askWithSearch(prompt, { what: `${name}'s campaigns`, effort: "low", log: l }),
      write: askPlain,
      fetchPage,
      checkImage: (url) => checkImageUrl(url, "campaign"),
    },
    log,
  );

  await prisma.$transaction(async (tx) => {
    await tx.campaign.deleteMany({ where: { brandId } });
    for (const [i, c] of campaigns.entries()) {
      await tx.campaign.create({
        data: {
          brandId,
          position: i + 1,
          title: c.title,
          description: c.description,
          // The date and the description note have no columns; they travel with the sources as evidence.
          sourceUrls: { date: c.date, note: c.descriptionNote, urls: c.sources },
          status: "proposed",
          images: {
            create: c.images.map(({ candidate, verdict }) => ({
              url: candidate.url,
              sourceKind: candidate.source.kind === "third_party" ? "third_party" : "brand",
              width: candidate.check.width ?? null,
              height: candidate.check.height ?? null,
              score: verdict.score,
              reason: verdict.reason,
              selected: candidate === c.chosen,
            })),
          },
        },
      });
    }
  });
}
