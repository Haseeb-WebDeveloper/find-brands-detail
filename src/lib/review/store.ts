import "server-only";
import type { CampaignStatus, CandidateScore, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TeamScope } from "@/lib/auth/scope";
import type { ReviewField } from "@/lib/export/row";
import type { TypedCheck } from "@/lib/review/check-typed";
import { REQUIRED_FIELDS, reviewSummary, type RequiredField } from "@/lib/research/review-summary";

type Tx = Prisma.TransactionClient;
const json = (value: unknown) => value as Prisma.InputJsonValue;

/** Any edit re-opens an approved or exported brand: approval is for the state the reviewer saw. */
async function reopen(tx: Tx, brandId: string) {
  await tx.brand.updateMany({ where: { id: brandId, status: { in: ["approved", "exported"] } }, data: { status: "needs_review" } });
}

/** Keeps the batch table's "needs you" count right after a reviewer's choice. */
async function recount(tx: Tx, brandId: string) {
  const selections = await tx.selection.findMany({ where: { brandId }, include: { candidate: { select: { score: true } } } });
  const fields = Object.fromEntries(
    REQUIRED_FIELDS.map((f) => [f, selections.find((s) => s.field === f)?.candidate?.score ?? null]),
  ) as Record<RequiredField, CandidateScore | null>;
  await tx.brand.update({ where: { id: brandId }, data: { reviewCount: reviewSummary(fields).count } });
}

async function select(tx: Tx, brandId: string, field: ReviewField, candidateId: string) {
  await tx.selection.upsert({
    where: { brandId_field: { brandId, field } },
    create: { brandId, field, candidateId, chosenBy: "reviewer" },
    update: { candidateId, typedValue: null, chosenBy: "reviewer" },
  });
  await reopen(tx, brandId);
  await recount(tx, brandId);
}

/** The brand a write belongs to, for revalidating its pages; null when it doesn't exist. */
export type Written = { brandId: string; batchId: string } | null;

async function owner(tx: Tx, brandId: string): Promise<Written> {
  const b = await tx.brand.findUnique({ where: { id: brandId }, select: { id: true, batchId: true } });
  return b ? { brandId: b.id, batchId: b.batchId } : null;
}

// ─── Fields ─────────────────────────────────────────────────────────────────

export async function chooseCandidate(_scope: TeamScope, brandId: string, field: ReviewField, candidateId: string): Promise<Written> {
  return prisma.$transaction(async (tx) => {
    const c = await tx.candidate.findFirst({ where: { id: candidateId, brandId, field }, select: { id: true } });
    if (!c) return null;
    await select(tx, brandId, field, c.id);
    return owner(tx, brandId);
  });
}

/** A typed value becomes a candidate like any other, with its check as evidence. */
export async function addTypedCandidate(_scope: TeamScope, brandId: string, field: ReviewField, check: TypedCheck): Promise<Written> {
  return prisma.$transaction(async (tx) => {
    const found = await owner(tx, brandId);
    if (!found) return null;
    const c = await tx.candidate.create({
      data: { brandId, field, value: check.value, source: "Typed by a reviewer", score: check.score, reason: check.reason, evidence: json(check.evidence) },
      select: { id: true },
    });
    await select(tx, brandId, field, c.id);
    return found;
  });
}

// ─── Brand text and approval ────────────────────────────────────────────────

export type BrandTextInput = { description: string; tier: string; aesthetic: string; industry: string; regions: string };

export async function saveBrandText(_scope: TeamScope, brandId: string, text: BrandTextInput): Promise<Written> {
  return prisma.$transaction(async (tx) => {
    const found = await owner(tx, brandId);
    if (!found) return null;
    await tx.brandText.upsert({ where: { brandId }, create: { brandId, ...text }, update: text });
    await reopen(tx, brandId);
    return found;
  });
}

export async function setBrandStatus(_scope: TeamScope, brandId: string, status: "approved" | "needs_review"): Promise<Written> {
  return prisma.$transaction(async (tx) => {
    const found = await owner(tx, brandId);
    if (!found) return null;
    await tx.brand.update({ where: { id: brandId }, data: { status } });
    return found;
  });
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

async function campaignOwner(tx: Tx, campaignId: string) {
  const c = await tx.campaign.findUnique({ where: { id: campaignId }, select: { brandId: true, position: true, brand: { select: { batchId: true } } } });
  return c ? { brandId: c.brandId, batchId: c.brand.batchId, position: c.position } : null;
}

export async function updateCampaign(_scope: TeamScope, campaignId: string, data: { title: string; description: string }): Promise<Written> {
  return prisma.$transaction(async (tx) => {
    const c = await campaignOwner(tx, campaignId);
    if (!c) return null;
    await tx.campaign.update({ where: { id: campaignId }, data: { title: data.title.trim(), description: data.description.trim() } });
    await reopen(tx, c.brandId);
    return { brandId: c.brandId, batchId: c.batchId };
  });
}

export async function setCampaignStatus(_scope: TeamScope, campaignId: string, status: CampaignStatus): Promise<Written> {
  return prisma.$transaction(async (tx) => {
    const c = await campaignOwner(tx, campaignId);
    if (!c) return null;
    await tx.campaign.update({ where: { id: campaignId }, data: { status } });
    await reopen(tx, c.brandId);
    return { brandId: c.brandId, batchId: c.batchId };
  });
}

/** Swaps the campaign with its neighbour above (-1) or below (+1); the order is the export's slot order. */
export async function moveCampaign(_scope: TeamScope, campaignId: string, by: -1 | 1): Promise<Written> {
  return prisma.$transaction(async (tx) => {
    const c = await campaignOwner(tx, campaignId);
    if (!c) return null;
    const neighbour = await tx.campaign.findFirst({
      where: { brandId: c.brandId, position: by < 0 ? { lt: c.position } : { gt: c.position } },
      orderBy: { position: by < 0 ? "desc" : "asc" },
      select: { id: true, position: true },
    });
    if (neighbour) {
      await tx.campaign.update({ where: { id: neighbour.id }, data: { position: c.position } });
      await tx.campaign.update({ where: { id: campaignId }, data: { position: neighbour.position } });
      await reopen(tx, c.brandId);
    }
    return { brandId: c.brandId, batchId: c.batchId };
  });
}

export async function selectCampaignImage(_scope: TeamScope, campaignId: string, imageId: string): Promise<Written> {
  return prisma.$transaction(async (tx) => {
    const c = await campaignOwner(tx, campaignId);
    const image = await tx.campaignImage.findFirst({ where: { id: imageId, campaignId }, select: { id: true } });
    if (!c || !image) return null;
    await tx.campaignImage.updateMany({ where: { campaignId }, data: { selected: false } });
    await tx.campaignImage.update({ where: { id: imageId }, data: { selected: true } });
    await reopen(tx, c.brandId);
    return { brandId: c.brandId, batchId: c.batchId };
  });
}

export type CheckedImage = { url: string; sourceKind: "brand" | "third_party"; width: number | null; height: number | null; score: CandidateScore; reason: string };

/** A reviewer's image for a campaign, already checked; it becomes the selected one. */
export async function addCampaignImage(_scope: TeamScope, campaignId: string, image: CheckedImage): Promise<Written> {
  return prisma.$transaction(async (tx) => {
    const c = await campaignOwner(tx, campaignId);
    if (!c) return null;
    await tx.campaignImage.updateMany({ where: { campaignId }, data: { selected: false } });
    await tx.campaignImage.create({ data: { campaignId, ...image, selected: true } });
    await reopen(tx, c.brandId);
    return { brandId: c.brandId, batchId: c.batchId };
  });
}

/** A campaign the research missed, typed in full by the reviewer: approved, last in order. */
export async function addCampaign(
  _scope: TeamScope,
  brandId: string,
  data: { title: string; description: string; image: CheckedImage | null },
): Promise<Written> {
  return prisma.$transaction(async (tx) => {
    const found = await owner(tx, brandId);
    if (!found) return null;
    const last = await tx.campaign.aggregate({ where: { brandId }, _max: { position: true } });
    await tx.campaign.create({
      data: {
        brandId,
        position: (last._max.position ?? 0) + 1,
        title: data.title.trim(),
        description: data.description.trim(),
        sourceUrls: { date: null, note: null, urls: [] },
        status: "approved",
        images: data.image ? { create: [{ ...data.image, selected: true }] } : undefined,
      },
    });
    await reopen(tx, brandId);
    return found;
  });
}

/** The brand's name and its own domains, to label a reviewer's image as brand-owned or third-party. */
export async function brandForImages(_scope: TeamScope, brandId: string): Promise<{ name: string; domains: string[] } | null> {
  const b = await prisma.brand.findUnique({ where: { id: brandId }, select: { name: true, candidates: { where: { field: "website", score: { not: "rejected" } }, select: { value: true } } } });
  if (!b) return null;
  return { name: b.name, domains: b.candidates.map((c) => new URL(c.value).hostname) };
}

export async function campaignBrand(_scope: TeamScope, campaignId: string): Promise<string | null> {
  return (await prisma.campaign.findUnique({ where: { id: campaignId }, select: { brandId: true } }))?.brandId ?? null;
}
