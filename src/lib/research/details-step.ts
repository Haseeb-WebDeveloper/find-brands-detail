import "server-only";
import { prisma } from "@/lib/prisma";
import { aiAvailable, askWithSearch } from "@/lib/ai/models";
import { detailsPrompt, mergeDraft, parseDetails } from "@/lib/details/draft";
import { loadResearchPages } from "@/lib/research/pages";
import type { ResearchLog } from "@/lib/research/log-types";

type IgEvidence = { followers?: number | null; biography?: string | null };

/**
 * Drafts the brand details the DB needs (description, tier, aesthetic, industry, regions) from what
 * research found plus a web search. Runs inside the Inngest job (AGENTS.md rule 2 exception). Fills
 * only empty fields: what a reviewer typed stays.
 */
export async function runDetailsStep(brandId: string, log: ResearchLog): Promise<void> {
  if (!aiAvailable()) {
    await log("No AI key is set up, so brand details weren't drafted. Fill them in on the brand page.", "warn");
    return;
  }
  const [{ name, pages }, selections, campaigns, current] = await Promise.all([
    loadResearchPages(brandId),
    prisma.selection.findMany({ where: { brandId, field: { in: ["website", "instagram"] } }, include: { candidate: true } }),
    prisma.campaign.findMany({ where: { brandId, status: { not: "removed" } }, orderBy: { position: "asc" }, select: { title: true } }),
    prisma.brandText.findUnique({ where: { brandId } }),
  ]);
  const text = {
    description: current?.description ?? "",
    tier: current?.tier ?? "",
    aesthetic: current?.aesthetic ?? "",
    industry: current?.industry ?? "",
    regions: current?.regions ?? "",
  };
  if (Object.values(text).every((v) => v.trim())) {
    await log("Brand details were already filled in.");
    return;
  }

  const site = selections.find((s) => s.field === "website")?.candidate?.value ?? null;
  const ig = selections.find((s) => s.field === "instagram")?.candidate;
  const igE = (ig?.evidence ?? {}) as IgEvidence;
  const siteText = pages
    .map((p) => [p.facts.title, p.facts.description].filter(Boolean).join(" — "))
    .filter(Boolean)
    .join("\n");

  const answer = await askWithSearch(
    detailsPrompt({
      brand: name,
      website: site ? new URL(site).hostname.replace(/^www\./, "") : null,
      instagram: ig ? { handle: ig.value, followers: typeof igE.followers === "number" ? igE.followers : null, bio: igE.biography ?? null } : null,
      siteText,
      campaigns: campaigns.map((c) => c.title),
    }),
    { what: `${name}'s brand details`, effort: "low", log, accept: (t) => parseDetails(t) !== null },
  );
  const draft = answer ? parseDetails(answer) : null;
  if (!draft) {
    await log("Couldn't draft the brand details. Fill them in on the brand page.", "warn");
    return;
  }

  const merged = mergeDraft(text, draft);
  await prisma.brandText.upsert({ where: { brandId }, create: { brandId, ...merged }, update: merged });
  const filled = (["description", "tier", "aesthetic", "industry", "regions"] as const).filter((k) => !text[k].trim() && merged[k].trim());
  const summary = [merged.tier && !text.tier ? merged.tier : null, merged.industry && !text.industry ? merged.industry.replace(/\|/g, ", ") : null]
    .filter(Boolean)
    .join(" · ");
  await log(filled.length > 0 ? `Drafted ${filled.join(", ")}${summary ? ` (${summary})` : ""}.` : "Nothing new to draft.", filled.length > 0 ? "good" : "info");
}
