import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lookupBusiness } from "@/lib/instagram/discovery";
import { fetchBadge } from "@/lib/instagram/badge";
import { checkBioLink } from "@/lib/instagram/bio-link";
import { researchInstagram } from "@/lib/instagram/research";
import { siteRegion, type CheckedSite } from "@/lib/website/research";
import { registrableDomain } from "@/lib/website/domain";
import type { PageFacts } from "@/lib/website/extract";

const json = (value: unknown) => value as Prisma.InputJsonValue;
const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");

/**
 * Runs inside the Inngest job, after the website step, so it takes no scope (AGENTS.md rule 2
 * exception). Reads the pages the website step saved; re-running replaces the Instagram candidates
 * and the auto selection.
 */
export async function runInstagramStep(brandId: string): Promise<void> {
  const brand = await prisma.brand.findUniqueOrThrow({
    where: { id: brandId },
    include: { pages: { where: { source: "live" } }, candidates: { where: { field: "website" } } },
  });

  const brandDomains = [
    ...new Set(brand.candidates.filter((c) => c.score !== "rejected").map((c) => registrableDomain(new URL(c.value).hostname))),
  ];
  const pages = brand.pages.map((p) => {
    const facts = p.facts as PageFacts;
    // siteRegion reads only the site's URL and facts; a minimal CheckedSite carries both.
    const site = { url: p.url, source: "hint", verdict: { score: "proven", kind: "ok", reason: "", siteUrl: p.url }, facts, archive: null } as CheckedSite;
    return { url: p.url, region: siteRegion(site), facts };
  });

  // The network work happens before the transaction, so no database connection waits on Meta.
  const { scored, chosen } = await researchInstagram({ brand: brand.name, pages, brandDomains }, { lookupBusiness, fetchBadge, checkBioLink });

  await prisma.$transaction(async (tx) => {
    await tx.selection.deleteMany({ where: { brandId, field: "instagram" } });
    await tx.candidate.deleteMany({ where: { brandId, field: "instagram" } });
    let chosenId: string | null = null;
    for (const { candidate: c, verdict } of scored) {
      const p = c.discovery.ok ? c.discovery.profile : null;
      const row = await tx.candidate.create({
        data: {
          brandId,
          field: "instagram",
          value: c.handle,
          source: c.foundOn.length > 0 ? `Linked from ${host(c.foundOn[0].url)}` : "Name variant",
          score: verdict.score,
          reason: verdict.reason,
          evidence: json({
            followers: p?.followers ?? null,
            name: p?.name ?? null,
            website: p?.website ?? null,
            verified: c.verified,
            bioReached: c.bio.reached,
            profilePictureUrl: p?.profilePictureUrl ?? null,
            recentMedia: p?.recentMedia ?? [],
            discovery: c.discovery.ok ? "ok" : c.discovery.reason,
          }),
        },
        select: { id: true },
      });
      if (c === chosen) chosenId = row.id;
    }
    if (chosenId) await tx.selection.create({ data: { brandId, field: "instagram", candidateId: chosenId, chosenBy: "auto" } });
  });
}
