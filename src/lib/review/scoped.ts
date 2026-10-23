import "server-only";
import { prisma } from "@/lib/prisma";
import type { TeamScope } from "@/lib/auth/scope";
import { REVIEW_FIELDS, type ReviewField, type ReviewState } from "@/lib/export/row";
import { storedFraming } from "@/lib/review/framing-input";

/** The brand as the export sees it: chosen values (typed ones included), the reviewer's text, campaigns in order. */
export async function getReviewState(_scope: TeamScope, brandId: string): Promise<ReviewState | null> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      selections: { include: { candidate: true } },
      text: true,
      campaigns: { orderBy: { position: "asc" }, include: { images: { where: { selected: true } } } },
    },
  });
  if (!brand) return null;
  const chosen = (f: ReviewField) => brand.selections.find((s) => s.field === f);
  const value = (f: ReviewField) => chosen(f)?.typedValue ?? chosen(f)?.candidate?.value ?? null;
  return {
    name: brand.name,
    website: value("website"),
    instagram: value("instagram"),
    tiktok: value("tiktok"),
    logo: value("logo"),
    cover: value("cover"),
    coverFraming: storedFraming(chosen("cover")?.candidate?.framing),
    text: {
      description: brand.text?.description ?? "",
      tier: brand.text?.tier ?? "",
      aesthetic: brand.text?.aesthetic ?? "",
      industry: brand.text?.industry ?? "",
      regions: brand.text?.regions ?? "",
    },
    campaigns: brand.campaigns.map((c) => ({ title: c.title, description: c.description, imageUrl: c.images[0]?.url ?? null, imageFraming: storedFraming(c.images[0]?.framing), status: c.status })),
    rejected: REVIEW_FIELDS.filter((f) => chosen(f)?.candidate?.score === "rejected"),
  };
}
