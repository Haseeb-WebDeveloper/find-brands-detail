import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkImageUrl } from "@/lib/images/check-image";
import { researchImages } from "@/lib/images/research";
import { loadResearchPages } from "@/lib/research/pages";
import type { ResearchLog } from "@/lib/research/log-types";

const json = (value: unknown) => value as Prisma.InputJsonValue;
type IgEvidence = { profilePictureUrl?: string | null; recentMedia?: { mediaType: string; mediaUrl: string | null }[] };
type TtEvidence = { avatarUrl?: string | null };

/**
 * Runs inside the Inngest job after the social steps, so it takes no scope (AGENTS.md rule 2
 * exception). Re-running replaces the logo and cover candidates and their auto selections.
 */
export async function runImagesStep(brandId: string, log: ResearchLog): Promise<void> {
  const [{ pages }, selections] = await Promise.all([
    loadResearchPages(brandId),
    prisma.selection.findMany({ where: { brandId, field: { in: ["instagram", "tiktok"] } }, include: { candidate: true } }),
  ]);
  const ig = selections.find((s) => s.field === "instagram")?.candidate;
  const tt = selections.find((s) => s.field === "tiktok")?.candidate;
  const igE = (ig?.evidence ?? {}) as IgEvidence;
  const ttE = (tt?.evidence ?? {}) as TtEvidence;
  const input = {
    pages: pages.map((p) => ({ url: p.url, facts: p.facts })),
    instagram: ig
      ? {
          handle: ig.value,
          picture: igE.profilePictureUrl ?? null,
          posts: (igE.recentMedia ?? []).flatMap((m) => (m.mediaType !== "VIDEO" && m.mediaUrl ? [m.mediaUrl] : [])),
        }
      : null,
    tiktok: tt ? { handle: tt.value, avatar: ttE.avatarUrl ?? null } : null,
  };

  // The network work happens before the transaction, so no database connection waits on a download.
  const result = await researchImages(input, { checkImage: checkImageUrl }, log);

  await prisma.$transaction(async (tx) => {
    for (const field of ["logo", "cover"] as const) {
      await tx.selection.deleteMany({ where: { brandId, field } });
      await tx.candidate.deleteMany({ where: { brandId, field } });
      let chosenId: string | null = null;
      for (const { candidate: c, verdict } of result[field].scored) {
        const row = await tx.candidate.create({
          data: {
            brandId,
            field,
            value: c.url,
            source: c.source.label,
            score: verdict.score,
            reason: verdict.reason,
            evidence: json({
              kind: c.source.kind,
              width: c.check.width ?? null,
              height: c.check.height ?? null,
              format: c.check.format ?? null,
              bytes: c.check.bytes ?? null,
              contentType: c.check.contentType ?? null,
              expiresAt: c.expiresAt?.toISOString() ?? null,
            }),
          },
          select: { id: true },
        });
        if (c === result[field].chosen) chosenId = row.id;
      }
      if (chosenId) await tx.selection.create({ data: { brandId, field, candidateId: chosenId, chosenBy: "auto" } });
    }
  });
}
