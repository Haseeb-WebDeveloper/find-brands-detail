"use server";

import { revalidatePath } from "next/cache";
import { getTeamScope, scopeCan } from "@/lib/auth/scope";
import { REVIEW_FIELDS, toList, type ReviewField } from "@/lib/export/row";
import { TIER_OPTIONS } from "@/lib/export/importer/brand-create";
import { checkTyped, type TypedDeps } from "@/lib/review/check-typed";
import { validateCampaignInput } from "@/lib/review/campaign-input";
import { cleanFraming } from "@/lib/review/framing-input";
import { getReviewState } from "@/lib/review/scoped";
import {
  addCampaign as storeAddCampaign,
  addCampaignImage as storeAddCampaignImage,
  addTypedCandidate,
  brandForImages,
  campaignBrand,
  frameCampaignImage as storeFrameCampaignImage,
  frameCandidate as storeFrameCandidate,
  chooseCandidate,
  reorderCampaigns as storeReorderCampaigns,
  saveBrandText as storeSaveBrandText,
  selectCampaignImage as storeSelectCampaignImage,
  setBrandStatus,
  setCampaignStatus as storeSetCampaignStatus,
  updateCampaign,
  type CheckedImage,
  type Written,
} from "@/lib/review/store";
import { fetchPage } from "@/lib/website/fetch-page";
import { judgeSite } from "@/lib/website/judge";
import { lookupBusiness } from "@/lib/instagram/discovery";
import { lookupProfile } from "@/lib/tiktok/profile";
import { checkImageUrl } from "@/lib/images/check-image";
import { resolvePostImage } from "@/lib/instagram/post-image";
import { domainMatchesBrand, registrableDomain } from "@/lib/website/domain";

type Result = { ok: true } | { ok: false; error: string };
type Checked = { ok: true; score: "proven" | "review" | "rejected"; reason: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DENIED = { ok: false, error: "You can't change brands." } as const;
const MISSING = { ok: false, error: "That doesn't exist any more. Reload the page." } as const;
const BAD_FRAMING = { ok: false, error: "That framing can't be used. Press Fill frame and place it again." } as const;

function refresh(written: NonNullable<Written>) {
  revalidatePath(`/brands/${written.brandId}`);
  revalidatePath(`/batches/${written.batchId}`);
}

const deps = (brand: string): TypedDeps => ({ brand, fetchPage, judgeSite, lookupBusiness, lookupProfile, checkImage: checkImageUrl, resolvePost: resolvePostImage });

/**
 * Checks a reviewer's campaign image (an image address, or an Instagram post's link) and labels it
 * brand-owned or third-party: by its domain, or for a post, by whether the brand's chosen Instagram
 * account posted it.
 */
async function checkCampaignImage(brand: { name: string; domains: string[]; instagram: string | null }, url: string): Promise<CheckedImage | { error: string }> {
  const check = await checkTyped("campaign", url, deps(brand.name));
  if (check.score === "rejected") return { error: check.reason.replace(/^Typed by a reviewer\. /, "") };
  const e = check.evidence as { width?: number | null; height?: number | null; post?: string; owner?: string | null };
  const host = new URL(check.value).hostname;
  const owned = e.post
    ? Boolean(e.owner && e.owner === brand.instagram)
    : brand.domains.some((d) => registrableDomain(d) === registrableDomain(host)) || domainMatchesBrand(host, brand.name);
  return { url: check.value, sourceKind: owned ? "brand" : "third_party", width: e.width ?? null, height: e.height ?? null, score: owned ? check.score : "review", reason: check.reason };
}

// ─── Fields ─────────────────────────────────────────────────────────────────

/** The reviewer picks another of the candidates research found. */
export async function chooseValue(brandId: string, field: ReviewField, candidateId: string, framing?: unknown): Promise<Result> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "batches:write")) return DENIED;
  if (!UUID.test(brandId) || !UUID.test(candidateId) || !REVIEW_FIELDS.includes(field)) return MISSING;
  const f = framing === undefined ? undefined : cleanFraming(framing);
  if (f && !f.ok) return BAD_FRAMING;
  const written = await chooseCandidate(scope, brandId, field, candidateId, f?.framing);
  if (!written) return MISSING;
  refresh(written);
  return { ok: true };
}

/** The reviewer types a value; it is checked at once, the way research checks (spec §8). */
export async function typeValue(brandId: string, field: ReviewField, value: string): Promise<Checked> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "batches:write")) return DENIED;
  if (!UUID.test(brandId) || !REVIEW_FIELDS.includes(field)) return MISSING;
  if (!value.trim() || value.length > 2_000) return { ok: false, error: "Type a value first." };
  const state = await getReviewState(scope, brandId);
  if (!state) return MISSING;
  const check = await checkTyped(field, value, deps(state.name));
  const written = await addTypedCandidate(scope, brandId, field, check);
  if (!written) return MISSING;
  refresh(written);
  return { ok: true, score: check.score, reason: check.reason };
}

// ─── Brand text and approval ────────────────────────────────────────────────

export async function saveBrandText(brandId: string, text: { description: string; tier: string; aesthetic: string; industry: string; regions: string }): Promise<Result> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "batches:write")) return DENIED;
  if (!UUID.test(brandId)) return MISSING;
  const tier = text.tier.trim().toLowerCase();
  if (tier && !(TIER_OPTIONS as readonly string[]).includes(tier)) return { ok: false, error: `Tier must be ${TIER_OPTIONS.join(", ")}.` };
  const written = await storeSaveBrandText(scope, brandId, {
    description: text.description.trim().slice(0, 5_000),
    tier,
    aesthetic: toList(text.aesthetic),
    industry: toList(text.industry),
    regions: toList(text.regions),
  });
  if (!written) return MISSING;
  refresh(written);
  return { ok: true };
}

/** "Done": the reviewer has looked at the brand. Progress only; nothing is required (owner, 2026-10-21). */
export async function markReviewed(brandId: string): Promise<Result> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "batches:write")) return DENIED;
  if (!UUID.test(brandId)) return MISSING;
  const written = await setBrandStatus(scope, brandId, "approved");
  if (!written) return MISSING;
  refresh(written);
  return { ok: true };
}

export async function reopenBrand(brandId: string): Promise<Result> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "batches:write")) return DENIED;
  if (!UUID.test(brandId)) return MISSING;
  const written = await setBrandStatus(scope, brandId, "needs_review");
  if (!written) return MISSING;
  refresh(written);
  return { ok: true };
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

export async function saveCampaign(campaignId: string, data: { title: string; description: string }): Promise<Result> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "batches:write")) return DENIED;
  if (!UUID.test(campaignId)) return MISSING;
  const problem = validateCampaignInput(data);
  if (problem) return { ok: false, error: problem };
  const written = await updateCampaign(scope, campaignId, data);
  if (!written) return MISSING;
  refresh(written);
  return { ok: true };
}

export async function setCampaignStatus(campaignId: string, status: "approved" | "removed" | "proposed"): Promise<Result> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "batches:write")) return DENIED;
  if (!UUID.test(campaignId) || !["approved", "removed", "proposed"].includes(status)) return MISSING;
  const written = await storeSetCampaignStatus(scope, campaignId, status);
  if (!written) return MISSING;
  refresh(written);
  return { ok: true };
}

const ids = (list: unknown): string[] | null => (Array.isArray(list) && list.length <= 50 && list.every((x) => typeof x === "string" && UUID.test(x)) ? list : null);

/** The brand's campaigns in the order dragged (the export's slot order). */
export async function reorderCampaigns(brandId: string, order: string[]): Promise<Result> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "batches:write")) return DENIED;
  const list = ids(order);
  if (!UUID.test(brandId) || !list) return MISSING;
  const written = await storeReorderCampaigns(scope, brandId, list);
  if (!written) return MISSING;
  refresh(written);
  return { ok: true };
}

/** Makes an image the campaign's one; with `framing`, where it sits in the tile too ("Use this image" in the viewer). */
export async function selectCampaignImage(campaignId: string, imageId: string, framing?: unknown): Promise<Result> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "batches:write")) return DENIED;
  if (!UUID.test(campaignId) || !UUID.test(imageId)) return MISSING;
  const f = framing === undefined ? undefined : cleanFraming(framing);
  if (f && !f.ok) return BAD_FRAMING;
  const written = await storeSelectCampaignImage(scope, campaignId, imageId, f?.framing);
  if (!written) return MISSING;
  refresh(written);
  return { ok: true };
}

export async function addCampaignImage(campaignId: string, url: string): Promise<Checked> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "batches:write")) return DENIED;
  if (!UUID.test(campaignId)) return MISSING;
  const brandId = await campaignBrand(scope, campaignId);
  const brand = brandId ? await brandForImages(scope, brandId) : null;
  if (!brand) return MISSING;
  const image = await checkCampaignImage(brand, url);
  if ("error" in image) return { ok: false, error: image.error };
  const written = await storeAddCampaignImage(scope, campaignId, image);
  if (!written) return MISSING;
  refresh(written);
  return { ok: true, score: image.score, reason: image.reason };
}

export async function addCampaign(brandId: string, data: { title: string; description: string; imageUrl: string }): Promise<Result> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "batches:write")) return DENIED;
  if (!UUID.test(brandId)) return MISSING;
  const problem = validateCampaignInput(data);
  if (problem) return { ok: false, error: problem };
  const brand = await brandForImages(scope, brandId);
  if (!brand) return MISSING;
  let image: CheckedImage | null = null;
  if (data.imageUrl.trim()) {
    const checked = await checkCampaignImage(brand, data.imageUrl);
    if ("error" in checked) return { ok: false, error: checked.error };
    image = checked;
  }
  const written = await storeAddCampaign(scope, brandId, { title: data.title, description: data.description, image });
  if (!written) return MISSING;
  refresh(written);
  return { ok: true };
}

// ─── Framing ────────────────────────────────────────────────────────────────

/** Where a campaign image sits in its tile ("Save framing" in the viewer); null is the centre crop. */
export async function frameCampaignImage(imageId: string, framing: unknown): Promise<Result> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "batches:write")) return DENIED;
  if (!UUID.test(imageId)) return MISSING;
  const f = cleanFraming(framing);
  if (!f.ok) return BAD_FRAMING;
  const written = await storeFrameCampaignImage(scope, imageId, f.framing);
  if (!written) return MISSING;
  refresh(written);
  return { ok: true };
}

/** Where a cover sits in its card ("Save framing" in the viewer); null is the centre crop. */
export async function frameCover(candidateId: string, framing: unknown): Promise<Result> {
  const scope = await getTeamScope();
  if (!scope || !scopeCan(scope, "batches:write")) return DENIED;
  if (!UUID.test(candidateId)) return MISSING;
  const f = cleanFraming(framing);
  if (!f.ok) return BAD_FRAMING;
  const written = await storeFrameCandidate(scope, candidateId, f.framing);
  if (!written) return MISSING;
  refresh(written);
  return { ok: true };
}
