import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lookupProfile } from "@/lib/tiktok/profile";
import { readLinkPage } from "@/lib/tiktok/link-page";
import { checkBioLink } from "@/lib/instagram/bio-link";
import { researchTiktok } from "@/lib/tiktok/research";
import { loadResearchPages } from "@/lib/research/pages";
import type { ResearchLog } from "@/lib/research/log-types";

const json = (value: unknown) => value as Prisma.InputJsonValue;
const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");

/**
 * Runs inside the Inngest job, after the Instagram step, so it takes no scope (AGENTS.md rule 2
 * exception). Re-running replaces the TikTok candidates and the auto selection.
 */
export async function runTiktokStep(brandId: string, log: ResearchLog): Promise<void> {
  const [{ name, pages, brandDomains }, ig] = await Promise.all([
    loadResearchPages(brandId),
    prisma.selection.findFirst({ where: { brandId, field: "instagram" }, include: { candidate: true } }),
  ]);
  const igEvidence = (ig?.candidate?.evidence ?? {}) as { website?: string | null };
  const instagram = ig?.candidate ? { handle: ig.candidate.value, website: igEvidence.website ?? null } : null;

  // The network work happens before the transaction, so no database connection waits on TikTok.
  const { scored, chosen } = await researchTiktok({ brand: name, pages, brandDomains, instagram }, { lookupProfile, readLinkPage, checkBioLink }, log);

  await prisma.$transaction(async (tx) => {
    await tx.selection.deleteMany({ where: { brandId, field: "tiktok" } });
    await tx.candidate.deleteMany({ where: { brandId, field: "tiktok" } });
    let chosenId: string | null = null;
    for (const { candidate: c, verdict } of scored) {
      const p = c.lookup.ok ? c.lookup.profile : null;
      const first = c.foundOn[0];
      const row = await tx.candidate.create({
        data: {
          brandId,
          field: "tiktok",
          value: c.handle,
          source: !first ? "Name variant" : first.kind === "site" ? `Linked from ${host(first.url)}` : `Linked from the Instagram bio page (${host(first.url)})`,
          score: verdict.score,
          reason: verdict.reason,
          evidence: json({
            followers: p?.followers ?? null,
            name: p?.name ?? null,
            verified: p?.verified ?? null,
            private: p?.private ?? null,
            bioLink: p?.bioLink ?? null,
            bioReached: c.bio.reached,
            sameBioAsInstagram: c.sameBioAsInstagram,
            lookup: c.lookup.ok ? "ok" : c.lookup.reason,
          }),
        },
        select: { id: true },
      });
      if (c === chosen) chosenId = row.id;
    }
    if (chosenId) await tx.selection.create({ data: { brandId, field: "tiktok", candidateId: chosenId, chosenBy: "auto" } });
  });
}
