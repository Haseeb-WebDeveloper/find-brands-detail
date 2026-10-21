// Copied from db-admin src/lib/schemas/brand-import.ts (2026-10-21). Keep in step with the importer.
/**
 * CSV bulk-import row schema.
 *
 * One row = one brand with exactly one profile. Multi-profile brands are not
 * expressible in a flat sheet; add extra region/country profiles afterward via
 * the brand edit form.
 *
 * Validation delegates to the existing `brand-create` zod sub-schemas rather
 * than re-implementing them, so handle normalization, tier options, and source
 * rules cannot drift between the create form and the importer.
 */

import {
  sourceSchema,
  campaignSchema,
  CAMPAIGN_DESCRIPTION_MAX,
  TIER_OPTIONS,
} from "./brand-create";
import { activationReasons } from "./activation";
import type { ImageSlot } from "@/lib/images/min-dimensions";

/** db-admin `src/types/backend.ts`, the parts the importer builds. */
interface ProfilePayload {
  regions: string[];
  countries: string[];
  industries: string[];
  sources: { platform: string; value: string }[];
}
interface CampaignPayload {
  title: string;
  description: string;
  image_url?: string;
}
export interface BrandCreatePayload {
  name: string;
  description?: string;
  tier?: string;
  aesthetic?: string[];
  industry?: string[];
  logo_url?: string;
  cover_image_url?: string;
  skip_logo_fetch?: boolean;
  parent_brand_id?: string;
  profiles: ProfilePayload[];
  campaigns: CampaignPayload[];
}

/** Multi-value cells are pipe-separated. Semicolons collide with the column
 *  delimiter in some Excel locales; pipes survive Sheets/Excel round-trips. */
export const MULTI_VALUE_DELIMITER = "|";

export const MAX_CAMPAIGN_SLOTS = 8;
export const MIN_CAMPAIGNS = 3;

export const BRAND_COLUMNS = [
  "name",
  "description",
  "tier",
  "brand_aesthetic",
  "brand_industry",
  "parent_brand_id",
  "logo_url",
  "cover_image_url",
  "profile_regions",
  "profile_countries",
  "profile_industries",
  "source_website",
  "source_instagram",
  "source_tiktok",
] as const;

export function campaignColumns(slot: number): {
  title: string;
  description: string;
  imageUrl: string;
} {
  return {
    title: `campaign_${slot}_title`,
    description: `campaign_${slot}_description`,
    imageUrl: `campaign_${slot}_image_url`,
  };
}

/** Full ordered header list, for the downloadable template. */
export const IMPORT_HEADERS: string[] = [
  ...BRAND_COLUMNS,
  ...Array.from({ length: MAX_CAMPAIGN_SLOTS }, (_, i) => {
    const c = campaignColumns(i + 1);
    return [c.title, c.description, c.imageUrl];
  }).flat(),
];

/** Columns whose value is a remote image URL, and which slot each fills. */
export function imageColumnSlot(column: string): ImageSlot | null {
  if (column === "logo_url") return "logo";
  if (column === "cover_image_url") return "cover";
  if (/^campaign_\d+_image_url$/.test(column)) return "campaign";
  return null;
}

/** Columns that hold a pipe-separated list. */
export const MULTI_VALUE_COLUMNS = new Set([
  "brand_aesthetic",
  "brand_industry",
  "profile_regions",
  "profile_countries",
  "profile_industries",
]);

/** Columns rendered as a textarea rather than a single-line input. */
export const LONG_TEXT_COLUMNS = new Set(["description"]);

/** Shown beside the tier input in the row editor. */
export const TIER_HINT = TIER_OPTIONS.join(" | ");

export type RawImportRow = Record<string, string | undefined>;

export interface CellError {
  column: string;
  message: string;
}

export interface ImageRef {
  column: string;
  url: string;
  slot: ImageSlot;
  /** Index into `payload.campaigns` — campaign slots only. */
  campaignIndex?: number;
}

export interface ParsedImportRow {
  name: string;
  payload: BrandCreatePayload;
  images: ImageRef[];
}

export type ImportRowValidation =
  | { ok: true; row: ParsedImportRow; warnings: CellError[] }
  | { ok: false; errors: CellError[]; warnings: CellError[] };

// ─── Cell helpers ────────────────────────────────────────────────────────────

function cell(raw: RawImportRow, column: string): string {
  return (raw[column] ?? "").trim();
}

export function splitMulti(value: string): string[] {
  return value
    .split(MULTI_VALUE_DELIMITER)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** First zod issue message, or a fallback. */
function firstIssue(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? "Invalid value";
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Hard errors block the commit. They mirror `brandCreateSchema`: without them
 * the backend create call would fail anyway.
 *
 * Soft warnings never block. They cover the open-vocabulary lookups (industry,
 * aesthetic, region, country are `CreatableCombobox` fields — admins invent new
 * values legitimately) and the activation rules the create schema does not
 * enforce, most notably the Instagram source.
 */
export function validateImportRow(raw: RawImportRow): ImportRowValidation {
  const errors: CellError[] = [];
  const warnings: CellError[] = [];

  const name = cell(raw, "name");
  if (!name) errors.push({ column: "name", message: "Brand name is required" });

  const description = cell(raw, "description");
  if (!description) {
    errors.push({ column: "description", message: "Description is required" });
  }

  const tier = cell(raw, "tier").toLowerCase();
  if (!tier) {
    errors.push({ column: "tier", message: "Tier is required" });
  } else if (!(TIER_OPTIONS as readonly string[]).includes(tier)) {
    errors.push({
      column: "tier",
      message: `Tier must be one of: ${TIER_OPTIONS.join(", ")}`,
    });
  }

  const aesthetic = splitMulti(cell(raw, "brand_aesthetic"));
  if (aesthetic.length === 0) {
    errors.push({
      column: "brand_aesthetic",
      message: `At least one aesthetic is required (separate with "${MULTI_VALUE_DELIMITER}")`,
    });
  }

  const industry = splitMulti(cell(raw, "brand_industry"));
  if (industry.length === 0) {
    errors.push({
      column: "brand_industry",
      message: `At least one industry is required (separate with "${MULTI_VALUE_DELIMITER}")`,
    });
  }

  const regions = splitMulti(cell(raw, "profile_regions"));
  const countries = splitMulti(cell(raw, "profile_countries"));
  const profileIndustries = splitMulti(cell(raw, "profile_industries"));
  if (regions.length === 0 && countries.length === 0 && profileIndustries.length === 0) {
    errors.push({
      column: "profile_regions",
      message:
        "Set at least one of profile_regions, profile_countries, or profile_industries",
    });
  }

  // ── Sources — delegate to sourceSchema so handle rules stay in one place ──
  const sources: Array<{ platform: "website" | "instagram" | "tiktok"; value: string }> = [];
  const sourceCells: Array<[string, "website" | "instagram" | "tiktok"]> = [
    ["source_website", "website"],
    ["source_instagram", "instagram"],
    ["source_tiktok", "tiktok"],
  ];

  for (const [column, platform] of sourceCells) {
    const value = cell(raw, column);
    if (!value) continue;
    const parsed = sourceSchema.safeParse({ platform, value });
    if (!parsed.success) {
      errors.push({ column, message: firstIssue(parsed.error) });
      continue;
    }
    sources.push({ platform, value: parsed.data.value });
  }

  if (!sources.some((s) => s.platform === "website")) {
    errors.push({
      column: "source_website",
      message: "A website source is required",
    });
  }

  // ── Images ────────────────────────────────────────────────────────────────
  const images: ImageRef[] = [];

  const logoUrl = cell(raw, "logo_url");
  if (!logoUrl) {
    errors.push({ column: "logo_url", message: "Logo URL is required" });
  } else if (!isHttpUrl(logoUrl)) {
    errors.push({ column: "logo_url", message: "Must be an http(s) URL" });
  } else {
    images.push({ column: "logo_url", url: logoUrl, slot: "logo" });
  }

  const coverUrl = cell(raw, "cover_image_url");
  if (!coverUrl) {
    errors.push({ column: "cover_image_url", message: "Cover image URL is required" });
  } else if (!isHttpUrl(coverUrl)) {
    errors.push({ column: "cover_image_url", message: "Must be an http(s) URL" });
  } else {
    images.push({ column: "cover_image_url", url: coverUrl, slot: "cover" });
  }

  // ── Campaigns ─────────────────────────────────────────────────────────────
  const campaigns: Array<{ title: string; description: string }> = [];
  let malformedCampaigns = 0;

  for (let slot = 1; slot <= MAX_CAMPAIGN_SLOTS; slot++) {
    const cols = campaignColumns(slot);
    const title = cell(raw, cols.title);
    const desc = cell(raw, cols.description);
    const imageUrl = cell(raw, cols.imageUrl);

    // An entirely empty slot is a trailing gap, not an error.
    if (!title && !desc && !imageUrl) continue;

    const parsed = campaignSchema.safeParse({ title, description: desc });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const column = issue?.path[0] === "description" ? cols.description : cols.title;
      errors.push({ column, message: firstIssue(parsed.error) });
      malformedCampaigns++;
      continue;
    }

    // The backend caps this; catching it here turns a mid-commit 422 (which
    // would roll the whole brand back) into a fixable dry-run error.
    if (desc.length > CAMPAIGN_DESCRIPTION_MAX) {
      errors.push({
        column: cols.description,
        message: `${desc.length} characters — the maximum is ${CAMPAIGN_DESCRIPTION_MAX}`,
      });
      malformedCampaigns++;
      continue;
    }

    if (!imageUrl) {
      errors.push({ column: cols.imageUrl, message: "Campaign image URL is required" });
      malformedCampaigns++;
      continue;
    }
    if (!isHttpUrl(imageUrl)) {
      errors.push({ column: cols.imageUrl, message: "Must be an http(s) URL" });
      malformedCampaigns++;
      continue;
    }

    images.push({
      column: cols.imageUrl,
      url: imageUrl,
      slot: "campaign",
      campaignIndex: campaigns.length,
    });
    campaigns.push({ title: parsed.data.title, description: parsed.data.description });
  }

  // Only report the shortfall when it is not merely a consequence of the
  // per-campaign errors already listed above — otherwise fixing one broken
  // image URL appears to be two separate problems.
  if (campaigns.length < MIN_CAMPAIGNS && campaigns.length + malformedCampaigns < MIN_CAMPAIGNS) {
    errors.push({
      column: campaignColumns(1).title,
      message: `At least ${MIN_CAMPAIGNS} complete campaigns are required (found ${campaigns.length})`,
    });
  }

  // ── Soft warnings ─────────────────────────────────────────────────────────
  // Activation needs an Instagram source; brandCreateSchema does not. The brand
  // imports either way — it just cannot go Active until one exists.
  const activationBlocks = activationReasons({
    description,
    campaignCount: campaigns.length,
    aesthetic,
    industry,
    sources: sources.map((s) => ({ platform: s.platform, url: s.value })),
  });
  for (const reason of activationBlocks) {
    if (reason === "Add an Instagram source") {
      warnings.push({
        column: "source_instagram",
        message: "No Instagram source — this brand cannot be activated until one is added",
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors, warnings };

  const payload: BrandCreatePayload = {
    name,
    description,
    tier,
    aesthetic,
    industry,
    ...(cell(raw, "parent_brand_id")
      ? { parent_brand_id: cell(raw, "parent_brand_id") }
      : {}),
    profiles: [
      {
        regions,
        countries,
        industries: profileIndustries,
        sources,
      },
    ],
    campaigns: campaigns.map((c) => ({ ...c, image_url: undefined })),
    // Images are uploaded after create, exactly as BrandCreateForm does.
    skip_logo_fetch: true,
  };

  return { ok: true, row: { name, payload, images }, warnings };
}

/**
 * Values the lookup endpoints have never seen. Not an error — `CreatableCombobox`
 * lets curators introduce new vocabulary — but worth surfacing before a typo
 * becomes a new industry.
 */
export function lookupWarnings(
  raw: RawImportRow,
  known: {
    aesthetics: Set<string>;
    industries: Set<string>;
    regions: Set<string>;
    countries: Set<string>;
  },
): CellError[] {
  const out: CellError[] = [];
  const checks: Array<[string, Set<string>, string]> = [
    ["brand_aesthetic", known.aesthetics, "aesthetic"],
    ["brand_industry", known.industries, "industry"],
    ["profile_industries", known.industries, "industry"],
    ["profile_regions", known.regions, "region"],
    ["profile_countries", known.countries, "country"],
  ];

  for (const [column, vocabulary, label] of checks) {
    if (vocabulary.size === 0) continue; // lookup unavailable — do not cry wolf
    for (const value of splitMulti(cell(raw, column))) {
      if (!vocabulary.has(value.toLowerCase())) {
        out.push({
          column,
          message: `"${value}" is a new ${label} — it will be created`,
        });
      }
    }
  }
  return out;
}
