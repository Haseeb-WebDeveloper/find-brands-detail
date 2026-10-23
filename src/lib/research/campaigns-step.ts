import "server-only";
import { prisma } from "@/lib/prisma";
import { aiAvailable, askPlain, askWithSearch } from "@/lib/ai/models";
import { checkImageUrl } from "@/lib/images/check-image";
import { fetchPage } from "@/lib/website/fetch-page";
import { researchCampaigns, writeDescriptions } from "@/lib/campaigns/research";
import { readCampaignPage } from "@/lib/campaigns/page";
import { distinctiveWords } from "@/lib/campaigns/posts";
import { parseCampaignsAnswer } from "@/lib/campaigns/find";
import { loadResearchPages } from "@/lib/research/pages";
import { fetchPostHistory, type IgPost } from "@/lib/instagram/history";
import { searchImages } from "@/lib/images/search";
import type { ResearchLog } from "@/lib/research/log-types";

type IgEvidence = { recentMedia?: { mediaType: string; mediaUrl: string | null; caption: string | null; permalink?: string; timestamp?: string }[] };

/** The search and writing models for one brand, as the campaign research takes them. */
const models = (name: string) => ({
  write: (prompt: string) => askPlain(prompt, `${name}'s campaign descriptions`),
  searchDescribe: (prompt: string, log: ResearchLog) =>
    askWithSearch(prompt, { what: `${name}'s campaign descriptions`, effort: "low", log, accept: (t) => /"descriptions"/.test(t) }),
});

/**
 * Runs inside the Inngest job, so it takes no scope (AGENTS.md rule 2 exception). Research replaces
 * the brand's campaigns; `more` (Fill, or "Find more campaigns") keeps every campaign there, skips
 * their titles (removed ones too, so they don't come back) and adds the new ones after them.
 */
export async function runCampaignsStep(brandId: string, log: ResearchLog, { more = false }: { more?: boolean } = {}): Promise<void> {
  // Without a model there is nothing to search with; the campaigns already here (added by hand) stay.
  if (!aiAvailable()) {
    await log("No AI key is set up, so campaigns weren't searched. Add them by hand on the brand page.", "warn");
    return;
  }
  const [{ name, brandDomains }, selections, existing] = await Promise.all([
    loadResearchPages(brandId),
    prisma.selection.findMany({ where: { brandId, field: { in: ["website", "instagram"] } }, include: { candidate: true } }),
    more ? prisma.campaign.findMany({ where: { brandId }, select: { title: true, position: true } }) : Promise.resolve([]),
  ]);
  const site = selections.find((s) => s.field === "website")?.candidate?.value ?? null;
  const ig = selections.find((s) => s.field === "instagram")?.candidate;
  const input = {
    brand: name,
    site: site ? new URL(site).hostname.replace(/^www\./, "") : null,
    brandDomains,
    instagram: ig ? { handle: ig.value } : null,
    known: existing.map((c) => c.title),
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
      ...models(name),
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

  if (more && campaigns.length > 0) await log(`Added ${campaigns.length} more campaign${campaigns.length === 1 ? "" : "s"} after the ${existing.length} already here.`, "good");
  const after = Math.max(0, ...existing.map((c) => c.position));
  await prisma.$transaction(async (tx) => {
    if (!more) await tx.campaign.deleteMany({ where: { brandId } });
    for (const [i, c] of campaigns.entries()) {
      await tx.campaign.create({
        data: {
          brandId,
          position: after + i + 1,
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

type CampaignSources = { date?: string | null; note?: string | null; urls?: string[] };

/**
 * Fill: writes a description for each campaign that has an empty one, and touches nothing else (not
 * its title, images or status, nor any campaign that has a description). Reads the campaign's
 * source pages again for the text to write from; `writeDescriptions` searches the web when they're
 * too thin. Runs inside the Inngest job, so it takes no scope.
 */
export async function runDescriptionsStep(brandId: string, log: ResearchLog): Promise<void> {
  const [brand, empty] = await Promise.all([
    prisma.brand.findUniqueOrThrow({ where: { id: brandId }, select: { name: true } }),
    prisma.campaign.findMany({ where: { brandId, description: "", status: { not: "removed" } }, orderBy: { position: "asc" }, select: { id: true, title: true, sourceUrls: true } }),
  ]);
  if (empty.length === 0) return;
  const items = [];
  for (const c of empty) {
    const src = (c.sourceUrls ?? {}) as CampaignSources;
    const texts: string[] = [];
    for (const url of src.urls ?? []) {
      const page = await fetchPage(url);
      if (page.ok) texts.push(readCampaignPage(page.html, page.finalUrl ?? url, distinctiveWords(c.title, brand.name)).text);
    }
    items.push({ title: c.title, date: src.date ?? null, text: texts.join("\n\n"), sources: src.urls ?? [] });
  }
  const written = await writeDescriptions(brand.name, items, models(brand.name), log);
  let filled = 0;
  for (const [i, c] of empty.entries()) {
    const w = written[i];
    const src = (c.sourceUrls ?? {}) as CampaignSources;
    // Only while it's still empty: a reviewer may have typed one while this ran.
    const saved = await prisma.campaign.updateMany({
      where: { id: c.id, description: "" },
      data: { description: w.description, sourceUrls: { ...src, note: w.descriptionNote } },
    });
    if (saved.count > 0 && w.description) filled++;
  }
  await log(
    filled > 0 ? `Wrote ${filled} of ${empty.length} missing description${empty.length === 1 ? "" : "s"}.` : "No missing description could be written.",
    filled === empty.length ? "good" : "warn",
  );
}
