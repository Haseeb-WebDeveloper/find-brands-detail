import "server-only";
import { prisma } from "@/lib/prisma";
import { aiAvailable, askPlain, askWithSearch } from "@/lib/ai/models";
import { checkImageUrl } from "@/lib/images/check-image";
import { fetchPage } from "@/lib/website/fetch-page";
import { researchCampaigns } from "@/lib/campaigns/research";
import { parseCampaignsAnswer } from "@/lib/campaigns/find";
import { loadResearchPages } from "@/lib/research/pages";
import { fetchPostHistory, type IgPost } from "@/lib/instagram/history";
import { searchImages } from "@/lib/images/search";
import type { ResearchLog } from "@/lib/research/log-types";

type IgEvidence = { recentMedia?: { mediaType: string; mediaUrl: string | null; caption: string | null; permalink?: string; timestamp?: string }[] };

/**
 * Runs inside the Inngest job, so it takes no scope (AGENTS.md rule 2 exception). Re-running
 * replaces the brand's proposed campaigns.
 */
export async function runCampaignsStep(brandId: string, log: ResearchLog): Promise<void> {
  // Without a model there is nothing to search with; the campaigns already here (added by hand) stay.
  if (!aiAvailable()) {
    await log("No AI key is set up, so campaigns weren't searched. Add them by hand on the brand page.", "warn");
    return;
  }
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
    instagram: ig ? { handle: ig.value } : null,
  };
  // The 12 posts the Instagram step already read: the fallback when the history can't be read.
  const recent: IgPost[] = (((ig?.evidence ?? {}) as IgEvidence).recentMedia ?? []).map((m) => ({
    mediaType: m.mediaType,
    images: m.mediaType === "VIDEO" || !m.mediaUrl ? [] : [m.mediaUrl],
    caption: m.caption,
    timestamp: m.timestamp ?? "",
    permalink: m.permalink ?? "",
  }));

  // The network and model work happens before the transaction, so no database connection waits on it.
  const campaigns = await researchCampaigns(
    input,
    {
      // A second try when the first finds nothing: the answer varies from run to run.
      search: async (prompt, l) => {
        const ask = () => askWithSearch(prompt, { what: `${name}'s campaigns`, effort: "low", log: l, accept: (t) => parseCampaignsAnswer(t).length > 0 });
        return (await ask()) ?? ask();
      },
      write: askPlain,
      fetchPage,
      checkImage: (url) => checkImageUrl(url, "campaign"),
      loadPosts: async (since) => {
        if (!ig) return { posts: [], error: null };
        const history = await fetchPostHistory(ig.value, since);
        return history.posts.length > 0 ? history : { posts: recent, error: history.error };
      },
      searchImages,
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
            // The chosen image first: the first usable image is the one used (review/store.ts).
            create: [...c.images]
              .sort((a, b) => Number(b.candidate === c.chosen) - Number(a.candidate === c.chosen))
              .map(({ candidate, verdict }, position) => ({
              position,
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
