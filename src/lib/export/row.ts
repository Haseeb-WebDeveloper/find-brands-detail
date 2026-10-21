import { MAX_CAMPAIGN_SLOTS, MULTI_VALUE_DELIMITER, campaignColumns, type RawImportRow } from "@/lib/export/importer/brand-import";

export type ReviewField = "website" | "instagram" | "tiktok" | "logo" | "cover";
export const REVIEW_FIELDS: readonly ReviewField[] = ["website", "instagram", "tiktok", "logo", "cover"];

export type ReviewState = {
  name: string;
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  logo: string | null;
  cover: string | null;
  text: { description: string; tier: string; aesthetic: string; industry: string; regions: string };
  campaigns: { title: string; description: string; imageUrl: string | null; status: "proposed" | "approved" | "removed" }[];
  /** Fields whose chosen value was checked and failed: never exported (spec §8 "nothing is red"). */
  rejected: ReviewField[];
};

/** "clean, clinical" or "clean|clinical" → "clean|clinical", the importer's list form. */
export function toList(value: string): string {
  return value
    .split(/[|,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(MULTI_VALUE_DELIMITER);
}

/** One importer row for a brand: only approved campaigns, in their order, in consecutive slots. */
export function buildImportRow(state: ReviewState): RawImportRow {
  const row: RawImportRow = {
    name: state.name,
    description: state.text.description.trim(),
    tier: state.text.tier.trim().toLowerCase(),
    brand_aesthetic: toList(state.text.aesthetic),
    brand_industry: toList(state.text.industry),
    profile_regions: toList(state.text.regions),
    source_website: state.website ?? "",
    source_instagram: state.instagram ?? "",
    source_tiktok: state.tiktok ?? "",
    logo_url: state.logo ?? "",
    cover_image_url: state.cover ?? "",
  };
  const approved = state.campaigns.filter((c) => c.status === "approved").slice(0, MAX_CAMPAIGN_SLOTS);
  approved.forEach((c, i) => {
    const cols = campaignColumns(i + 1);
    row[cols.title] = c.title;
    row[cols.description] = c.description;
    row[cols.imageUrl] = c.imageUrl ?? "";
  });
  return row;
}
