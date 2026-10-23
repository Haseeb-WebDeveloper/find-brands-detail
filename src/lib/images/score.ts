import type { ImageCheckResult } from "@/lib/images/check-image";

export type ImageSource = { kind: "site" | "instagram" | "tiktok" | "third_party"; label: string };
export type ImageCandidate = { slot: "logo" | "cover" | "campaign"; url: string; source: ImageSource; check: ImageCheckResult; expiresAt: Date | null };
export type ImageVerdict = { score: "proven" | "review" | "rejected"; reason: string };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** The DB shows logos square and cropped to fill; past this ratio a wordmark loses its ends. */
const MAX_LOGO_RATIO = 2;
/** The shape each slot is shown in: logos square, covers and campaigns as the importer fills them (db-admin FILL_FRAME_ASPECT). */
const SHAPE = { logo: 1, cover: 16 / 11, campaign: 200 / 236 } as const;
/**
 * A cover is a landscape banner; anything narrower is a portrait or a square (owner, 2026-10-21). It
 * can still be used, cut to the card and framed by the reviewer, so it needs a look rather than being
 * refused (owner, 2026-10-23: "even though it shows not a landscape image, I should be able to use it").
 */
const MIN_COVER_RATIO = 1.3;
/** Statuses that mean the host refused our server, not that the image is bad (bot protection, Akamai). */
const BLOCKED = new Set([401, 403]);

/** The host wouldn't give our server the image: it may be fine, but nothing about it could be checked. */
export const isBlocked = (c: ImageCandidate) => !c.check.ok && BLOCKED.has(c.check.status);
/** How far from the 16:11 frame a cover may be and still count as a good fit: about 1.3:1 to 2.3:1. */
const COVER_FIT = 0.45;
/** Logos: the brand's own profile picture first, Instagram's then TikTok's (owner, 2026-10-21: "that is the best option"). */
const LOGO_SOURCE = { instagram: 0, tiktok: 1, site: 2, third_party: 3 } as const;

const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Spec §7, Logo and cover, and campaign images. */
export function scoreImage(c: ImageCandidate, now: Date): ImageVerdict {
  const { check } = c;
  if (isBlocked(c)) {
    // Seen from the cloud only: the same request from a browser, or another network, often works.
    return {
      score: "review",
      reason: `${c.source.label} blocks servers from downloading it (${check.status}), so its size couldn't be checked, and the DB import may be blocked too. If it is, upload the file there.`,
    };
  }
  if (!check.ok || !check.width || !check.height) return { score: "rejected", reason: check.reason ?? "Not an image." };
  const size = `${check.width}×${check.height}`;
  if (!check.passesMin) return { score: "rejected", reason: `${size} — below the ${check.minDimension}px minimum for a ${c.slot}.` };
  const ratio = Math.max(check.width, check.height) / Math.min(check.width, check.height);
  if (c.slot === "logo" && ratio > MAX_LOGO_RATIO) {
    return { score: "review", reason: `${size}: too ${check.width > check.height ? "wide" : "tall"} for the square logo frame, so it would be cropped.` };
  }
  if (c.slot === "cover" && check.width / check.height < MIN_COVER_RATIO) {
    const shape = check.width < check.height ? "portrait" : "nearly square";
    const expiry = c.expiresAt && c.expiresAt.getTime() - now.getTime() < WEEK_MS ? ` The link expires on ${day(c.expiresAt)}; export soon after review.` : "";
    return { score: "review", reason: `${size} from ${c.source.label}: ${shape}, so the 16:11 cover card cuts a strip from it. Open it full screen to frame it.${expiry}` };
  }
  if (c.source.kind === "third_party") return { score: "review", reason: `${size} from ${c.source.label}, a third-party page.` };
  const from = `${size} from ${c.source.label}.`;
  if (c.expiresAt && c.expiresAt.getTime() <= now.getTime()) {
    return { score: "review", reason: `${from} The link expired on ${day(c.expiresAt)}; re-run research for a fresh one.` };
  }
  if (c.expiresAt && c.expiresAt.getTime() - now.getTime() < WEEK_MS) {
    return { score: "review", reason: `${from} The link expires on ${day(c.expiresAt)}; export soon after review.` };
  }
  return { score: "proven", reason: from };
}

/** How far an image is from the shape its slot is shown in (0 = exact). */
function misfit(c: ImageCandidate): number {
  const { width = 1, height = 1 } = c.check;
  return Math.abs(Math.log(width / height / SHAPE[c.slot]));
}

/**
 * Logos: the Instagram profile picture, else TikTok's, else the site's best. Everything else: proven
 * first, then review; within a level the best-fitting shape, then the most pixels. Whenever anything
 * can be used, something is picked (owner, 2026-10-23): a blocked image, whose shape is unknown, last.
 */
export function chooseImage(scored: { candidate: ImageCandidate; verdict: ImageVerdict }[]): ImageCandidate | null {
  const usable = scored.filter((s) => s.verdict.score !== "rejected").map((s) => s.candidate);
  const profile = usable
    .filter((c) => c.slot === "logo" && (c.source.kind === "instagram" || c.source.kind === "tiktok"))
    .sort((a, b) => LOGO_SOURCE[a.source.kind] - LOGO_SOURCE[b.source.kind]);
  if (profile.length > 0) return profile[0];
  // Covers: a reasonable fit to the frame, then the order they were found in (a site's first hero
  // slide is its current campaign; size alone picked a 3000×1500 menu tile over TIRTIR's hero).
  // Everything else: the closest fit, then the biggest.
  const order = new Map(scored.map((s, i) => [s.candidate, i]));
  const rank = (c: ImageCandidate) =>
    c.slot === "cover"
      ? [isBlocked(c) ? 2 : misfit(c) > COVER_FIT ? 1 : 0, order.get(c) ?? 0]
      : [isBlocked(c) ? 100 : Math.round(misfit(c) * 10), -Math.min(c.check.width ?? 0, c.check.height ?? 0)];
  const better = (a: ImageCandidate, b: ImageCandidate) => {
    const [x, y] = [rank(a), rank(b)];
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i];
    return false;
  };
  for (const level of ["proven", "review"] as const) {
    const pool = scored.filter((s) => s.verdict.score === level).map((s) => s.candidate);
    if (pool.length > 0) return pool.reduce((best, c) => (better(c, best) ? c : best));
  }
  return null;
}

/** A cover that is a real landscape banner, checked: the kind worth searching for when none was found. */
export const isLandscapeCover = (c: ImageCandidate) => Boolean(c.check.ok && c.check.width && c.check.height && c.check.width / c.check.height >= MIN_COVER_RATIO);
