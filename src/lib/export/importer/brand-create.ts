// Copied from db-admin src/lib/schemas/brand-create.ts (2026-10-21). Keep in step with the importer.
/**
 * Zod schemas for the curation CMS brand create form.
 *
 * Mirrors the backend BrandCreatePayload (Phase 2 v6.1):
 * - Brand-level fields
 * - 1..N profiles (flat model, no primary)
 * - Per-profile sources (≥1, max 1 per platform per profile)
 * - ≥3 complete campaigns with images (form-enforced — DB allows nullable image_url)
 * - At least one website source across all profiles (logo.dev source)
 */

import { z } from "zod";
import { IG_HANDLE_RE, TT_HANDLE_RE } from "./platforms";

// ─── Regex constants (mirror backend) ────────────────────────────────────────

/** Instagram: accept profile URLs or bare handle; returns normalized username */
export function extractInstagramHandle(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  const noAt = raw.replace(/^@/, "");
  if (!/^https?:\/\//i.test(raw) && !/\binstagram\.com\b/i.test(raw)) {
    return noAt;
  }
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (!url.hostname.replace(/^www\./i, "").endsWith("instagram.com")) return noAt;
    const segment = url.pathname.split("/").filter(Boolean)[0];
    if (!segment) return noAt;
    const reserved = new Set([
      "p", "reel", "reels", "stories", "explore", "accounts", "about", "direct",
    ]);
    if (reserved.has(segment.toLowerCase())) return raw;
    return segment.replace(/^@/, "").split("?")[0];
  } catch {
    return noAt;
  }
}

/** TikTok: accept profile URLs or bare handle; returns normalized username */
export function extractTikTokHandle(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  const noAt = raw.replace(/^@/, "");
  if (!/^https?:\/\//i.test(raw) && !/\btiktok\.com\b/i.test(raw)) {
    return noAt;
  }
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (!url.hostname.replace(/^www\./i, "").endsWith("tiktok.com")) return noAt;
    const path = url.pathname;
    const atMatch = path.match(/\/@([^/?]+)/);
    if (atMatch) return atMatch[1];
    const parts = path.split("/").filter(Boolean);
    if (parts[0] && ["in", "legal", "foryou", "explore", "following", "live"].includes(parts[0].toLowerCase())) {
      return raw;
    }
    if (parts[0]) return parts[0].replace(/^@/, "").split("?")[0];
    return noAt;
  } catch {
    return noAt;
  }
}

// ─── Source ──────────────────────────────────────────────────────────────────
// `record_id` is optional and only set in edit mode — it carries the DB id
// so the edit form can diff existing rows vs new rows.
// `is_scraped` is optional and only set in edit mode — when true, the source
// value/handle is locked (UI prevents edits, backend rejects).
export const sourceSchema = z
  .object({
    record_id: z.string().optional(),
    is_scraped: z.boolean().optional(),
    platform: z.enum(["website", "instagram", "tiktok"], {
      message: "Platform is required",
    }),
    value: z.string().min(1, "Value is required"),
  })
  .superRefine((src, ctx) => {
    const v = src.value.trim();
    if (src.platform === "instagram") {
      const handle = extractInstagramHandle(v);
      if (!handle || !IG_HANDLE_RE.test(handle)) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message:
            /instagram\.com|^\s*https?:\/\//i.test(v)
              ? "Enter a valid Instagram profile URL or handle (e.g. brandname)"
              : "IG handle must be 1-30 chars (letters, digits, dots, underscores)",
        });
      }
    } else if (src.platform === "tiktok") {
      const handle = extractTikTokHandle(v);
      if (!handle || !TT_HANDLE_RE.test(handle)) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message:
            /tiktok\.com|^\s*https?:\/\//i.test(v)
              ? "Enter a valid TikTok profile URL (e.g. tiktok.com/@handle) or handle only"
              : "TikTok handle must be 2-24 chars (letters, digits, dots, underscores)",
        });
      }
    } else if (src.platform === "website") {
      // Loose URL check
      const url = v.startsWith("http") ? v : `https://${v}`;
      try {
        new URL(url);
      } catch {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: "Must be a valid URL",
        });
      }
    }
  })
  .transform((src) => {
    const v = src.value.trim();
    if (src.platform === "instagram") {
      const h = extractInstagramHandle(v);
      return { ...src, value: h && IG_HANDLE_RE.test(h) ? h : v };
    }
    if (src.platform === "tiktok") {
      const h = extractTikTokHandle(v);
      return { ...src, value: h && TT_HANDLE_RE.test(h) ? h : v };
    }
    return src;
  });

// ─── Campaign ────────────────────────────────────────────────────────────────

/** Backend limit, enforced by the campaign editor and the CSV importer alike. */
export const CAMPAIGN_DESCRIPTION_MAX = 500;

export const campaignSchema = z.object({
  record_id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  // image_url is OPTIONAL in the schema — file is held in form state, uploaded post-create
  image_url: z.string().optional(),
});

// ─── Constants (tier list must be declared before brandCreateSchema) ───────────
export const TIER_OPTIONS = ["luxury", "premium", "masstige"] as const;
