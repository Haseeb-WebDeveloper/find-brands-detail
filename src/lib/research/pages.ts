import "server-only";
import { prisma } from "@/lib/prisma";
import { siteRegion, type CheckedSite } from "@/lib/website/research";
import { registrableDomain } from "@/lib/website/domain";
import type { PageFacts } from "@/lib/website/extract";

/** What the social steps read from the website step: the brand's live pages with their market, and its domains. */
export async function loadResearchPages(brandId: string) {
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
  return { name: brand.name, pages, brandDomains };
}
